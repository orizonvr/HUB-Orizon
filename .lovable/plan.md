## Plano — Comitê: Briefing por projeto (snapshot congelado + IA-ready)

Escopo restrito ao Prompt C2. Não toca em migrations, fase de preparação ou realização, e não expõe a chave da Anthropic ao cliente.

### 1) Tipos e server functions — `src/lib/comites.functions.ts`

- Adicionar tipos exportados `BriefingCampos` e `BriefingSnapshot` (conforme spec).
- Estender `PautaItem` com `briefing_snapshot: BriefingSnapshot | null` e mapeá-lo em `getComiteDetail` a partir de `row.briefing_snapshot` (o select `*` já traz o campo).
- Nova fn `getBriefingContext({ pauta_id })` — `POST` + `requireSupabaseAuth`:
  - Carrega item da pauta → `projeto_id` → projeto (todos os campos de `BriefingCampos`).
  - Retorna `{ projeto_nome, campos_atuais, briefing }`.
- Nova fn `salvarBriefing({ pauta_id, texto (max 20000), origem: "manual"|"ia" })` — `POST` + `requireSupabaseAuth`:
  - Carrega pauta → comitê; exige `status === 'preparacao'` (senão throw).
  - Checa permissão como em `realizarComite`: busca `profiles.role` do `context.userId`; permite admin/lider ou `criado_por_id === userId`.
  - Lê campos atuais do projeto, monta `snapshot = { texto, campos, gerado_em, gerado_por_id, origem }`.
  - `update comite_pauta set briefing_snapshot = snapshot where id = pauta_id`.
- Nova fn `gerarBriefingIA({ pauta_id })` — `POST` + `requireSupabaseAuth`:
  - Mesma checagem de permissão.
  - Se `!process.env.ANTHROPIC_API_KEY` → `return { configured: false as const }`.
  - Caso contrário, `fetch` para `https://api.anthropic.com/v1/messages` com headers `x-api-key` + `anthropic-version`, system prompt em pt-BR (Resumo, Tese, Números-chave, Riscos, Próximos passos, Recomendação), `model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"`, `max_tokens: 1500`, mensagem com `JSON.stringify(campos)`.
  - Retorna `{ configured: true, texto }`. Não salva nada.

### 2) UI — `src/components/comites/briefing-drawer.tsx` (novo) + `src/routes/_authenticated/comites/$id.tsx`

- Novo componente `BriefingDrawer` usando `Sheet` (já existe em `@/components/ui/sheet`):
  - Props: `pautaId`, `open`, `onOpenChange`, `readOnly` (default deriva de `status !== 'preparacao'`).
  - Ao abrir, `useQuery(['briefing', pautaId], getBriefingContext)`.
  - Campos: `Textarea` (min-h 320px) com o markdown; toda edição manual marca `origem = "manual"`.
  - Botão "Gerar com IA": chama `gerarBriefingIA`. Se `configured: false` → `toast.info("Geração com IA ainda não disponível — aguardando liberação da chave da Anthropic pelo TI.")` e fica em modo manual. Se ok → preenche textarea + `origem = "ia"`.
  - Painel lateral (read-only) com os números que serão congelados, usando `campos_atuais` (ou `briefing.campos` se já existe), formatados via `formatValorTransacaoMM`, `formatTonDia`, `formatPercentOrizon` de `@/lib/format`. Nota: "Estes números serão congelados ao salvar."
  - Se já existe briefing: prefill `briefing.texto`, metadado `Gerado em {formatAbsolute(gerado_em)} · {origem}`, aviso "Salvar novamente recongela os números…".
  - Salvar → `salvarBriefing`, toast, invalida `["comite", id]` e `["briefing", pautaId]`, fecha.
  - `readOnly`: oculta botões "Salvar"/"Gerar com IA"; textarea fica `disabled`.

- Em `comites/$id.tsx`:
  - Cada item da pauta ganha botão "Briefing" (ícone `FileText`) que abre o drawer.
  - Indicador discreto (ponto verde + texto "Briefing pronto") quando `item.briefing_snapshot != null`.
  - No modo registro e no estado realizado, link "Ver briefing" abrindo o mesmo drawer em `readOnly`.
  - Estado local: `briefingPautaId: string | null` + `briefingReadOnly: boolean`.

### 3) Env — `.env.example`

Adicionar (com comentário server-side only):

```
# IA (Anthropic) — geração de briefing do comitê. SERVIDOR APENAS.
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-4-6"
```

### Garantias

- Sem migration: `comite_pauta.briefing_snapshot` jsonb já existe.
- Chave Anthropic só é lida dentro de `.handler()` da server fn; nunca `VITE_`, nunca no browser.
- Sem alteração na fase de preparação/realização além dos dois ganchos de UI ("Briefing" e "Ver briefing").
- Degradação elegante quando a chave falta.
- Snapshot congela na hora do save; edições futuras no projeto não afetam o briefing salvo.
- Edição bloqueada no servidor quando `status !== 'preparacao'` e para quem não é admin/lider/criador.