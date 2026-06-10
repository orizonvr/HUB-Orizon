## Plano — Edição em massa de projetos (Prompt E)

Adicionar edição em massa reutilizando a seleção (`compareIds`) já existente e a server function `updateProjeto` (que já valida permissões no servidor). Sem migration, sem nova server function.

### Arquivos

**Novo:** `src/components/projetos/editar-em-massa.tsx`
- Dialog controlado (`open`, `onOpenChange`).
- Props: `ids: string[]`, `profiles: Profile[]`, `config: ProjetoConfig`, `onApplied: () => void`.
- 4 selects, todos com opção "Manter" (sentinela `__keep__`):
  - Responsável → `profiles` (`nome_completo`), grava `responsavel_id`.
  - Líder → `profiles`, grava `lider_id`.
  - Estágio → `config.estagios` (key/label), grava `estagio`.
  - Status → `STATUS_LABEL` de `@/lib/ma-utils`, grava `status`.
- Monta `patch` apenas com campos ≠ "Manter".
- Botão "Aplicar" desabilitado se `patch` vazio ou enquanto carrega.
- Ao clicar Aplicar → `AlertDialog` de confirmação com resumo legível (ex.: "Responsável → Vinicius; Estágio → Due Diligence") + "{n} projetos".
- Ao confirmar: `useServerFn(updateProjeto)` + `Promise.allSettled(ids.map(id => fn({ data: { id, patch } })))`.
- Conta `fulfilled`/`rejected`:
  - Sem falhas → `toast.success("{X} projetos atualizados.")`.
  - Com falhas → `toast.warning("{X} atualizados · {Y} sem permissão ou com erro.")`.
- Ao terminar chama `onApplied()` e fecha o dialog.

**Editado:** `src/components/projetos/projetos-workspace.tsx`
- Novo state `showBulkEdit`.
- Novo botão "Editar em massa" na barra flutuante existente (entre "Comparar" e "Limpar"), visível com `compareIds.length >= 1`.
- Adicionar `const qc = useQueryClient()` no componente raiz.
- Renderizar `<EditarEmMassa>` recebendo `ids={compareIds}`, com `onApplied` que invalida `[config.queryKey]` e chama `clearCompare()`.

### Não mexer
- Lógica de seleção/comparação do Prompt D (apenas adicionar o botão).
- Permissão no cliente (servidor já valida; cliente só conta resultados).
- KanbanView, filtros, ProjectSheet, NewProjectDialog, tarefas, comitês.
- Sem campos numéricos no patch.
