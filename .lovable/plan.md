# Importação one-shot de tarefas do Planner via .xlsx

Substituir o fluxo CSV embutido por upload de `.xlsx` cru direto na aba Tarefas, restrito a admin, com preview + commit atômico e bloqueio anti-duplicação. Inclui null-safety no front para `prazo`.

## 1. Migration

```sql
ALTER TABLE public.tarefas ALTER COLUMN prazo DROP NOT NULL;
```

Tarefas abertas sem vencimento entram com `prazo = NULL`. Types do Supabase serão regenerados após aprovação.

## 2. Dependência

Adicionar `xlsx` (SheetJS). Parse acontece exclusivamente no servidor.

## 3. Server function — `src/lib/import-planner-xlsx.functions.ts`

Padrão de `tarefas.functions.ts`:
- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- `supabaseAdmin` via `await import(...)` dentro do handler
- Gate admin: lê `profiles.role` do `context.userId`; se != `"admin"` → throw `"Forbidden: apenas admin pode importar."`
- Reaproveita `norm()` (NFD, sem acento, lowercase, espaço colapsado)

**Parse (input base64):**
```ts
const wb = XLSX.read(base64, { type: "base64" });
const dados = XLSX.utils.sheet_to_json(wb.Sheets["Dados Consolidados"], { raw:false, defval:"" });
const usuarios = XLSX.utils.sheet_to_json(wb.Sheets["Usuários"], { raw:false, defval:"" });
```
Faltando "Dados Consolidados" → throw claro.

**Mapeamentos via `norm()`:**
- Status: `nao iniciado→pendente`, `em andamento→em_andamento`, `concluida→concluida`
- Prioridade: `baixa→baixa`, `media→media`, `importante→alta`, `urgente→alta` (prefixar `[Prioridade original: urgente]` na descrição)

**Pessoas:**
- `nomeNorm→email` via aba "Usuários"; `email→profile.id` via `profiles` (email lowercased)
- "Atribuído a": split `;` e `,`, trim. Resolvidos → `responsavel_ids`. Não resolvidos → `[Também: ...]` na descrição. `responsavel_ids` pode ficar `[]`.
- "Criado por": resolve igual; fallback = `context.userId`

**Datas:**
- `prazo` = "Data de conclusão". Vazio + status != concluida → `NULL`. Vazio + concluida → "Concluído em" || "Criado em".
- `concluida_em` = "Concluído em" (ISO) ou `NULL`
- `created_at`/`updated_at` = "Criado em" (ISO) ou `now()`

**Bucket "Categoria" → projeto:** match exato por `norm(nome)`, depois fuzzy (substring nos dois sentidos).

**Functions exportadas:**

**(A) `previewImportPlannerXlsx({ arquivo_base64 })`** — read-only. Retorna `total_linhas`, `por_status`, `por_prioridade`, `buckets_match`, `buckets_sem_match`, `nomes_sem_profile`, `tarefas_ja_no_banco`.

**(B) `commitImportPlannerXlsx({ arquivo_base64, mapeamento, novos_projetos, confirmar:"IMPORTAR_AGORA" })`:**
- Safety: `count(tarefas) > 0` → throw `"Tabela tarefas não está vazia (N). Importação abortada."`
- `mapeamento: Record<bucketNorm, projeto_id | "NOVO" | "PULAR">`
- `novos_projetos` criados com `responsavel_id`/`criado_por_id = context.userId`
- INSERT único atômico em `tarefas` com `{ count: "exact" }`
- Erro → rollback dos projetos recém-criados antes do throw
- Retorno: `{ ok, tarefas_inseridas, projetos_criados, puladas, sem_responsavel, breakdown_por_status }`

## 4. UI — botão na aba Tarefas

Em `src/routes/_authenticated/tarefas.tsx`, ao lado de "Reunião de Pipeline"/"Nova tarefa":
- Botão **"Importar do Planner"** (ícone `Upload`), visível só se `profile?.role === "admin"`
- `<Dialog>` único, 3 passos sequenciais:
  1. `<input type="file" accept=".xlsx">` → FileReader → base64 → "Analisar"
  2. Preview: totais, breakdown, buckets que casaram; `<Select>` por bucket sem match (projeto existente | criar novo tipo+status | pular). Aviso para nomes sem profile e bloqueio se já houver tarefas.
  3. "Importar agora" → commit → resultado + `toast.success`
- Após sucesso, `invalidateQueries`: `["tarefas"]`, `["tarefas-projeto"]`, `["minhas-tarefas"]`, `["resumo-tarefas-time"]`, `["alertas-tarefas"]`, `["projetos-lite"]`

## 4.1. Null-safety no front para `prazo`

Após `DROP NOT NULL`, tarefas podem ter `prazo = null`. Ajustar:

1. **`src/lib/tarefas-types.ts`**
   - `prazo: string` → `prazo: string | null`
   - Remover comentário "Sempre tem ≥1" de `responsavel_ids` (array vazio agora é válido)

2. **`src/components/tarefas/tarefas-tab.tsx` — `PrazoBadge`**
   - Tipar prop `prazo: string | null`
   - Se `!prazo`: renderizar badge muted "Sem prazo" e pular toda lógica de atrasada/hoje/em Nd
   - `formatPrazoBR`: se `!iso`, retornar "Sem prazo"

3. **Filtros de prazo** em `src/routes/_authenticated/tarefas.tsx` (~L163) e `src/components/tarefas/tarefas-workspace-view.tsx` (~L116)
   - No bloco `if (fPrazo !== "todos")`: se `!t.prazo` → `return false` (não entra em vencidas/hoje/7d/30d)

4. **`src/components/tarefas/tarefas-kanban-view.tsx`** (~L84) — sort null-safe:
   ```ts
   arr.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
   ```

5. **`src/components/tarefas/tarefas-workspace-view.tsx`** — contagem `vencidas` (~L131): guardar `if (!t.prazo) return false;` antes do `new Date(...)`

6. **`src/routes/_authenticated/projetos/$id.tsx`** (~L180 e ~L434): se `!t.prazo`, exibir "sem prazo" em vez de chamar `formatAbsolute(t.prazo)`

## 5. Limpeza

Apagar:
- `src/routes/_authenticated/admin-import.tsx`
- `src/lib/import-planner.functions.ts`
- `src/lib/import-planner-data.csv`

## Escopo intocado

`tarefas.functions.ts` (CRUD), `nova-rodada-drawer`, kanban/cards/workspace além dos ajustes null-safe, notificações, RLS, design system. Importação não cria atividades nem dispara notificações.

## Ordem de execução

1. Migration (`prazo` nullable) — aprova e regenera types
2. `bun add xlsx`
3. Criar `src/lib/import-planner-xlsx.functions.ts`
4. Aplicar null-safety (4.1) em todos os arquivos listados
5. Editar `tarefas.tsx` + componente do dialog de import
6. Apagar arquivos temporários
7. Security scan

## Checklist final

- [ ] Migration aplicada
- [ ] Botão só para admin
- [ ] Preview mostra ~419 linhas e buckets com/sem match
- [ ] Import cria tarefas; `;` vira múltiplos responsáveis
- [ ] 4 abertas sem vencimento entram com `prazo NULL`
- [ ] Kanban abre sem erro com `prazo NULL`
- [ ] Badge mostra "Sem prazo" (nunca "null")
- [ ] Filtro "Vencidas" não lista `prazo NULL`
- [ ] Re-rodar import → bloqueado, sem duplicar
- [ ] Arquivos temporários apagados
- [ ] Security scan limpo
