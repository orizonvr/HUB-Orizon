## Comparação de targets lado a lado

Adiciona seleção múltipla (2–4) de projetos nas views Tabela e Cards do `ProjetosWorkspace`, com barra flutuante e dialog de comparação por colunas. Tudo client-side, sem server function nem migration.

### 1) `src/components/projetos/projetos-workspace.tsx`

**Estado de seleção (no componente raiz, para persistir entre views):**
- `const [compareIds, setCompareIds] = useState<string[]>([])`
- `const [showCompare, setShowCompare] = useState(false)`
- `toggleCompare(id)`: se já está → remove; senão → se `length >= 4`, dispara `toast.info("Compare no máximo 4 projetos por vez.")` e retorna; senão adiciona.
- `clearCompare()`: zera array.

**Props nas views:**
- Passar `selectedIds: compareIds` e `onToggleSelect: toggleCompare` para `TableView` e `CardsView`. `KanbanView` permanece intacta.

**TableView:**
- Nova coluna à esquerda, header vazio (`<TableHead className="w-8" />`), célula com `<Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => onToggleSelect(p.id)} onClick={(e) => e.stopPropagation()} aria-label="Selecionar para comparar" />`.
- Linha continua clicável para abrir o sheet; o `stopPropagation` no checkbox evita disparar `onOpen`.

**CardsView:**
- Checkbox absoluto no canto superior direito do card (`absolute top-2 right-2`), com `onClick={(e) => e.stopPropagation()}`. Card continua com onClick para abrir o sheet; ajustar `position: relative` no card raiz se necessário.

**Barra flutuante (renderizada dentro do `mainView === "projetos"`, fora das views):**
- Aparece quando `compareIds.length >= 1`.
- `<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">` envolvendo um `<Card className="px-4 py-2 flex items-center gap-3 shadow-lg border-border">`:
  - `<span className="text-sm">{n} selecionado(s)</span>`
  - `<Button size="sm" disabled={compareIds.length < 2} onClick={() => setShowCompare(true)}>Comparar</Button>`
  - `<Button size="sm" variant="ghost" onClick={clearCompare}>Limpar</Button>`

**Dialog:**
```tsx
<CompararTargets
  open={showCompare}
  onOpenChange={setShowCompare}
  projetos={filtered.filter((p) => compareIds.includes(p.id))}
  profilesById={profileMap}
  config={config}
/>
```
Fechar o dialog NÃO limpa `compareIds`.

### 2) `src/components/projetos/comparar-targets.tsx` (novo)

```tsx
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetos: Projeto[];
  profilesById: Map<string, { nome_completo: string } | Profile>;
  config: ProjetoConfig;
};
```

**Layout:**
- `<Dialog>` / `<DialogContent className="max-w-[min(95vw,1100px)] max-h-[90vh] overflow-hidden flex flex-col">`.
- `<DialogHeader>` com título "Comparar targets" + descrição "{n} projetos lado a lado".
- Corpo: `<div className="overflow-auto">` com uma `<table>` semântica (não o `Table` shadcn — precisamos da primeira coluna fixa com `sticky left-0 bg-background`).
- Colunas:
  - Coluna 1 (sticky): rótulo da métrica, classes `sticky left-0 bg-background font-medium text-xs text-muted-foreground w-44`.
  - Demais colunas: uma por projeto. Header = `<div>` com `nome` (font-medium) + `<Badge variant="secondary">{config.estagioLabels[p.estagio]}</Badge>`.
- Linhas agrupadas por seções via `<tr>` de cabeçalho com `colSpan` cobrindo tudo (`bg-muted/40 text-xs uppercase tracking-wide`).

**Seções e linhas:**

Helper `cell(value)` → retorna `value || "—"`.

- **Identidade** (sempre)
  - Contraparte → `p.contraparte`
  - Setor → `p.setor`
  - Subcategoria → SÓ se `config.tipo === "novos_negocios"` (usar `SUBCATEGORIA_LABEL[p.subcategoria]` se existir; senão "—")
  - Status → `STATUS_LABEL[p.status]`
  - Saúde → `<span className="inline-flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", HEALTH_BG[healthFor(p)])} />{HEALTH_LABEL[healthFor(p)]}</span>`
  - Responsável → `profilesById.get(p.responsavel_id)?.nome_completo ?? "—"`
  - % Orizon → `formatPercentOrizon(p.percentual_orizon)`

- **Financeiro** (varia por `config.finVariant`)
  - `ma`: Valor da transação `formatValorTransacaoMM(p.valor_transacao_mm)`, Valor estimado `formatBRLFull(p.valor_estimado)`, EBITDA 2025 `formatBRLFull(p.ebitda_2025)`, EBITDA alvo `formatBRLFull(p.ebitda_alvo)`, Múltiplo EV/EBITDA `formatExtra(p.multiplo_ev_ebitda, "multiple")`, Sinergias estimadas `formatBRLFull(p.sinergias_estimadas)`, Volume `formatTonDia(p.volume_ton_dia)`.
  - `nn`: Investimento estimado `formatBRLFull(p.valor_estimado)`, Capex estimado `formatBRLFull(p.capex_estimado)`, TIR estimada `formatExtra(p.tir_estimada, "percent")`, Payback `formatExtra(p.payback_anos, "years")`, Receita projetada ano 3 `formatBRLFull(p.receita_projetada_ano3)`, TAM `formatBRLFull(p.tam)`, Volume `formatTonDia(p.volume_ton_dia)`.
  - Numéricos null → as próprias helpers já retornam "—".

- **Prazos** (sempre): Início `formatAbsolute(p.data_inicio)`, Fechamento previsto `formatAbsolute(p.data_fechamento_prevista)`.

- **Narrativa** (sempre, no fim): Tese, Riscos, Próximos passos — célula com `<div className="whitespace-pre-wrap text-xs">{p.tese || "—"}</div>` etc.

**Imports:** Dialog, Card, Button, Checkbox, Badge de `@/components/ui/*`; `formatBRLFull, MA_ESTAGIO_LABEL (não usado — usar config.estagioLabels), healthFor, HEALTH_BG, HEALTH_LABEL, STATUS_LABEL` de `@/lib/ma-utils`; `formatValorTransacaoMM, formatTonDia, formatPercentOrizon, formatAbsolute` de `@/lib/format`; `formatExtra, ProjetoConfig` de `@/lib/projetos-config`; `SUBCATEGORIA_LABEL` de `@/lib/projetos-types`; `cn` de `@/lib/utils`.

### Fora de escopo
- Sem alterações em filtros, ProjectSheet, KanbanView, NewProjectDialog, tarefas, server functions ou migrations.
- Sem novos formatters/labels — reutiliza os existentes.

### Validação manual
- Marcar 2–4 em Tabela e Cards; tentar 5º → toast e não adiciona.
- Clique no checkbox não abre o sheet.
- Barra flutuante aparece com ≥1, "Comparar" só habilita com ≥2.
- Dialog mostra métricas corretas por tipo, BR-formatado, "—" para nulos.
- Trocar de view preserva seleção. "Limpar" zera. Fechar dialog mantém seleção.
- M&A, Novos Negócios, e Tarefas continuam funcionando.
