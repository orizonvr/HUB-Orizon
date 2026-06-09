## Objetivo
Promover o drawer existente `NovaRodadaDrawer` para uma ação em destaque no Dashboard, renomeando-o conceitualmente para "Reunião de Pipeline". Nenhuma lógica interna do drawer muda.

## Escopo
4 arquivos apenas:
1. `src/routes/_authenticated/index.tsx` — novo card + estado do drawer
2. `src/routes/_authenticated/tarefas.tsx` — renomear label do botão
3. `src/components/tarefas/tarefas-workspace-view.tsx` — renomear label do botão
4. `src/components/tarefas/nova-rodada-drawer.tsx` — atualizar título e descrição do Sheet

## Detalhes

### 1. Renomeação de labels
- **tarefas.tsx** (linha ~218): botão "Nova rodada" → "Reunião de Pipeline"
- **tarefas-workspace-view.tsx** (linha ~152): botão "Nova rodada (reunião)" → "Reunião de Pipeline"
- **nova-rodada-drawer.tsx**:
  - `SheetTitle`: "Nova rodada da reunião de pipeline" → "Reunião de Pipeline"
  - `SheetDescription`: "Registre as tarefas que saíram da reunião..." → "Registre as tarefas decididas na reunião e atribua aos responsáveis"

### 2. Card de destaque no Dashboard
Inserir abaixo dos KPIs (após a grid de KPI cards, antes dos blocos `MinhasTarefasBlock` / `TarefasDoTimeBlock`).

- **Layout**: card com colunas — ícone à esquerda, texto central, botão à direita (responsivo: empilha em mobile).
- **Ícone**: `Users` (ou `CalendarCheck`) do Lucide.
- **Título**: "Reunião de Pipeline"
- **Subtítulo**: "Registre decisões e crie tarefas para o time"
- **Botão**: "Iniciar reunião" (variant primário) que chama `setShowReuniao(true)`.
- **Gating por role**: visível apenas se `profile?.role === "admin" || profile?.role === "lider"`. Mesmo padrão já usado em `tarefas.tsx`.
- **Estado**: `const [showReuniao, setShowReuniao] = useState(false);`
- **Profiles para o drawer**: o `index.tsx` não carrega `profiles` hoje. Adicionar `useQuery` para `listProfiles` (já importado de `@/lib/projetos.functions`) quando o usuário for admin/líder, passando `profiles` para o `NovaRodadaDrawer`.
- **Drawer**: renderizar `<NovaRodadaDrawer open={showReuniao} onOpenChange={setShowReuniao} profiles={profiles} />` ao final do componente, fora do grid.

### 3. Estilo
Usar tokens do design system existente (sage/champagne):
- fundo do card: `--accent` ou `--secondary` sutil
- ícone em círculo com `--primary` ou `--gold` como fundo
- sem cores berrantes, mantendo a paleta OrizonVR

### 4. Não mexer
- Lógica de criação de tarefas, validações, MultiProfileSelect
- Rotas, permissões de banco, schema
- Outras telas além das 4 acima
