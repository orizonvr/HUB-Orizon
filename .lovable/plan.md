## Prompt F — Dossiê do projeto (`/projetos/$id`)

Página dedicada, read-only, que consolida tudo de um projeto num output apresentável e exportável (copiar/baixar markdown). Reusa fetches existentes; adiciona 1 server fn nova e 1 rota nova. Sem migration.

### 1) Server — `src/lib/comites.functions.ts`

Adicionar `getDecisoesComiteByProjeto`:
- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- Input: `z.object({ projeto_id: z.string().uuid() })`
- Query: `comite_pauta` filtrando `projeto_id = X`, join (via `.select("..., comites!inner(id, titulo, data, status)")`) restringindo `comites.status = 'realizado'`.
- Retorna array ordenado por `comites.data desc`:
  `{ comite_id, comite_titulo, comite_data, decisao, justificativa, condicionantes, estagio_sugerido }`.

### 2) Nova rota — `src/routes/_authenticated/projetos/$id.tsx`

Padrão do `routes/_authenticated/comites/$id.tsx`. Fetches em paralelo com TanStack Query (useSuspenseQuery + `queryClient.ensureQueryData` no loader):
- `getProjetoDetail({ id })` (já existe — projeto, comentários, documentos, atividades)
- `listTarefasByProjeto({ projeto_id: id })` (já existe)
- `getDecisoesComiteByProjeto({ projeto_id: id })` (nova)
- `profilesQuery()` (já existe em `projetos-workspace.tsx` — importar de lá)

Config escolhido por `projeto.tipo` (`MA_CONFIG`/`NN_CONFIG` de `@/lib/projetos-config`).

**Layout** — uma coluna, `max-w-4xl mx-auto p-6 space-y-6`, scroll:

1. **Cabeçalho**
   - Botão "Voltar" → `/ma` ou `/novos-negocios` conforme `tipo`.
   - `<h1>` com `projeto.nome`; badges: tipo (`config.titulo`), estágio (`config.estagioLabels[projeto.estagio]`), status (`STATUS_LABEL`), bolinha de saúde (`healthFor` + `HEALTH_BG`/`HEALTH_LABEL` de `ma-utils`).
   - Direita: botões "Copiar dossiê" e "Baixar .md".

2. **Régua de estágios** — stepper horizontal com todos `config.estagios`, atual destacado (verde sage). Comentário: `// TODO: timeline a partir de atividades 'mudou_estagio'`.

3. **Resumo executivo** — contraparte, setor, subcategoria (apenas NN, via `SUBCATEGORIA_LABEL`), responsável e líder (nomes via `profileMap`), `% Orizon` (`formatPercentOrizon`), datas `data_inicio` / `data_fechamento_prevista` / `data_fechamento_real` (`formatAbsolute`), `status_detalhado`. Em seguida blocos de texto **Tese**, **Riscos**, **Próximos passos**, **Notas estratégicas** — cada um oculto se vazio.

4. **Financeiro** — mesmos campos por `config.finVariant` do `comparar-targets.tsx` (Prompt D), com os mesmos formatters; "—" para vazios. Nota discreta no topo: *"Será enriquecido pelo modelo financeiro."*

5. **Tarefas abertas** — filtra `status ∈ {pendente, em_andamento}`; lista com título, responsáveis (avatares/nomes), prazo (`formatAbsolute`), prioridade (`PRIORIDADE_LABEL`). Contagem no header. Empty state se nenhuma.

6. **Decisões de comitê** — uma entrada por item retornado. Badge de decisão reusando cores do Prompt C: `aprovado=primary`, `aprovado_com_ressalvas=âmbar`, `reprovado=destructive`, `adiado=muted`. Mostra justificativa, condicionantes, estágio sugerido e `"{comite_titulo} · {formatAbsolute(comite_data)}"`. Empty: *"Nenhuma decisão de comitê registrada."*

7. **Documentos** — lista (nome, tipo, enviado por, data). Sem download (continua no painel).

8. **Comentários recentes** — últimos 5 (`comentarios.slice(-5).reverse()`), com autor e data.

**Exportação markdown** — função local `buildDossieMd(projeto, …)` que monta seções (identidade, estágio atual, resumo executivo, financeiro, tarefas abertas, decisões de comitê):
- "Copiar dossiê": `navigator.clipboard.writeText(md)` + `toast.success`.
- "Baixar .md": Blob + `<a download>` com nome `dossie-{slug(nome)}.md` (slug = lower + replace acentos + `[^a-z0-9]+` → `-`). Mesmo padrão da ata do Prompt C.

### 3) Ponto de entrada — `src/components/ma/project-sheet.tsx`

No cabeçalho do sheet, adicionar botão "Abrir dossiê" (variant outline/ghost) que chama `useNavigate()({ to: "/projetos/$id", params: { id: projeto.id } })`. Não remover/alterar nada mais (abas, edição, etc.).

### Não mexer
- Sem migration; nenhuma tabela nova.
- Sem duplicar fetches existentes.
- Página é read-only; edição continua no painel lateral.
- Histórico de estágios fica como `// TODO`.
- Sem IA nesta etapa.
- Kanban, filtros, comparação (D), edição em massa (E), tarefas, comitês permanecem intactos exceto pelos 3 itens acima.
- Design system mantido (verde sage `#2D4A3E`, Linear/Attio), pt-BR, componentes `@/components/ui`, formatters de `@/lib/format`, `@/lib/ma-utils`, `@/lib/projetos-config`.
