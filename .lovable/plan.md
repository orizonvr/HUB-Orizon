# Importação das 420 tarefas do Planner — v2

Ajustes aplicados conforme seu feedback. Há **1 conflito de schema** que precisa de decisão sua antes de eu começar (item ⚠️ abaixo).

## ⚠️ Conflito a resolver

Você pediu **prazo NULL** para tarefas abertas sem vencimento, mas a coluna `tarefas.prazo` está declarada `NOT NULL` no schema atual e você também pediu pra não mexer no schema. Só dá pra ter um dos dois. Opções:

- **A.** Migração mínima `ALTER TABLE tarefas ALTER COLUMN prazo DROP NOT NULL` (1 linha, sem efeito em código existente — todas as queries lidam com `prazo` como string já preenchida). É o que assumo se você não disser nada.
- **B.** Manter NOT NULL e usar fallback (`concluida_em` → `criado_em`) para as ~15 abertas sem prazo.

Se for (A), incluo a migração na Etapa 0 e o código insere NULL quando vazio. Se for (B), pulo a migração.

## Etapa 0 — Migração (só se opção A)

Single migration: `ALTER TABLE public.tarefas ALTER COLUMN prazo DROP NOT NULL;`. Atualizo também `src/integrations/supabase/types.ts` para refletir `prazo: string | null` na linha `Row` e `Insert?`.

## Etapa 1 — Diagnóstico

Server function **autenticada com admin gate**: `createServerFn` com `requireSupabaseAuth` + checagem `profiles.role === 'admin'` (rejeita 403 caso contrário). Arquivo: `src/lib/import-planner.functions.ts`. Não uso `/api/public/*` — é endpoint privado, só você (admin logado) consegue invocar via `useServerFn` numa página temporária `/_authenticated/admin-import` (página simples, dois botões: "Rodar diagnóstico" e "Executar importação"; mostra resultado em `<pre>`).

A função `diagnosticarImportacao` recebe o CSV como string e retorna:

1. `count_atual` da tabela `tarefas`. **Se > 0, retorno aqui e paro** — você decide.
2. **Enums reais** lidos via `select enum_range(...)` em `tarefa_status`, `tarefa_prioridade`, `tarefa_origem`, `projeto_tipo`, `projeto_status` (para você conferir antes de decidir tipo/status dos novos projetos).
3. `projetos_existentes`: `[{id, nome, tipo}]` ordenado.
4. `profiles_existentes`: `[{id, email, nome_completo}]`.
5. **Tabela de correspondência** com 3 listas:
   - `match_exato`: bucket → projeto (lowercase + sem acento bate idêntico).
   - `match_fuzzy`: bucket → projeto candidato via `ilike '%nome%'` bilateral, com a string usada na busca (você confirma um a um).
   - `sem_match`: buckets que não bateram em nada — **lista crua, sem decisão pré-tomada**. Para cada um te dou: nome do bucket, quantas tarefas tem, primeiras 3 datas (criação) e responsável mais frequente. Você me responde, por bucket, qual `tipo` (`ma` | `novos_negocios`) e `status` (`ativo` | `pausado` | `concluido` | `arquivado` | `perdido`) usar, OU "pular".
6. `emails_sem_profile`: emails do CSV que não acharam dono.
7. `tarefas_por_bucket`: contagem por bucket.
8. `tarefas_sem_prazo`: quantas têm `data_vencimento` vazio (só pra você ter o número antes do insert).

**Paro aqui.** Você revisa e me passa: confirmações dos fuzzy, decisões individuais dos `sem_match`, e (se for opção B do prazo) confirma o fallback.

## Etapa 2 — Importação

Função `importarTarefasPlanner` (mesmo arquivo, mesmo admin gate) recebe:

- `csv: string`
- `mapeamento_aprovado: Record<bucketNormalizado, projeto_id | 'PULAR'>`
- `novos_projetos: [{bucket, nome, tipo, status}]` (pra criar antes do insert)

Execução **atômica via RPC**:

1. Crio uma função SQL `public.importar_tarefas_batch(novos_projetos jsonb, tarefas jsonb)` que:
   - `BEGIN; ... EXCEPTION WHEN OTHERS THEN RAISE;` — Postgres já roda funções plpgsql como uma transação implícita; se qualquer insert falhar, a função inteira aborta e **nada é commitado**.
   - Insere os novos projetos primeiro, devolve mapa `bucket → id`.
   - Faz `INSERT INTO tarefas (...) SELECT ... FROM jsonb_to_recordset(...)` com todas as 420 linhas de uma vez.
   - Retorna `{ projetos_criados: n, tarefas_inseridas: n }`.
   - Grant `EXECUTE` apenas a `authenticated`; a função interna confere `has_role(auth.uid(), 'admin')` no topo e dá `RAISE EXCEPTION 'forbidden'` caso contrário (defesa em profundidade — o gate JS já bloqueia).
2. A server fn TS monta o `jsonb` das tarefas no formato esperado pela função SQL (já com `projeto_id` resolvido, `criado_por_id` resolvido com fallback Renan, etc.) e chama a RPC.
3. **Sem partial commit:** se a RPC falhar, retorno o erro do Postgres e nada foi inserido. Se voltar OK, retorno a contagem real `tarefas_inseridas` que o SQL contou, e re-leio `count(*)` da tabela para confirmar.

**Mapeamento de campos** (sem mudanças vs v1, mas reforçando):

| CSV | `tarefas` | Transformação |
|---|---|---|
| `titulo` | `titulo` | direto |
| `projeto_planner` (normalizado) | `projeto_id` | via mapeamento aprovado; `'PULAR'` filtra a linha fora do batch |
| `status` | `status` | `nao_iniciada` → `pendente`; outros idênticos |
| `prioridade` | `prioridade` | `urgente` → `alta` (anota `[Prioridade original: urgente]` no início da descricao) |
| `responsavel_email` | `responsavel_ids` | `[profile_id]` se achou; `{}` se vazio/sem match |
| `criado_por_email` | `criado_por_id` | profile do email; fallback renan.dipardi |
| `criado_em` | `created_at` | preservado (cast para timestamptz às 00:00 UTC) |
| `data_vencimento` | `prazo` | **se opção A**: NULL quando vazio; **se opção B**: `concluida_em` → `criado_em` |
| `concluida_em` | `concluida_em` | direto (timestamptz às 00:00 UTC) |
| `notas` + extras | `descricao` | concatena `[Prioridade original: urgente]` e `[Concluída por: email]` quando aplicável |
| `data_inicio`, `concluida_por_email` | — | descartadas (sem coluna); `concluida_por_email` vai pra `descricao` |
| — | `origem` | `'ad_hoc'` |
| — | `data_reuniao` | NULL |

**Sem notificações, sem `atividades`** — o INSERT vai direto na tabela, não passa pela `createTarefa`.

## Etapa 3 — Verificação e limpeza

Retorno em tela:

- `count(*)` antes / depois (deve ser antes + 420 − pulados).
- Breakdown por status (esperado: 402/15/3 menos os pulados).
- Tarefas com `responsavel_ids = {}` (contagem + lista de títulos).
- Tarefas com criador = renan fallback (contagem).
- Projetos novos criados (id, nome, tipo, status).
- Buckets pulados.

Depois:

1. **Removo** `src/lib/import-planner.functions.ts` e `src/routes/_authenticated/admin-import.tsx`.
2. **Removo** a função SQL `importar_tarefas_batch` via migration de cleanup (`DROP FUNCTION`).
3. Se você usou opção A, a migração do `prazo DROP NOT NULL` **fica** — é a única mudança permanente.

## Arquivos tocados

**Criados temporários (apagados na Etapa 3):**
- `src/lib/import-planner.functions.ts`
- `src/routes/_authenticated/admin-import.tsx`

**Migrações:**
- Opção A apenas: `ALTER COLUMN prazo DROP NOT NULL` (fica) + atualização de `types.ts`.
- Sempre: `CREATE FUNCTION importar_tarefas_batch` (Etapa 2) + `DROP FUNCTION` (Etapa 3).

**Não tocados:** UI, RLS, `projetos.functions.ts`, `tarefas.functions.ts`, `notificacoes.*`, schema de qualquer outra tabela.

## Checklist final

- [ ] Opção A ou B para `prazo` confirmada
- [ ] `count(*)` antes vs depois
- [ ] Mapeamento aprovado por você (fuzzy confirmados + decisões individuais dos sem-match)
- [ ] Breakdown por status final
- [ ] Lista de tarefas sem responsável / com criador fallback
- [ ] Confirmação: 0 notificações, 0 emails, 0 linhas em `atividades`
- [ ] Arquivos e função SQL temporários removidos
