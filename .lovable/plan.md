# Plano — Comitê: fase de realização

Sem migrations e sem mexer em RLS. Toda a infra de banco já existe (`comites.status`, `ata_consolidada`, `comite_pauta.{decisao,justificativa,condicionantes,estagio_sugerido}`). Mudanças concentradas em **1 arquivo server** e **1 arquivo de rota**.

## 1) Server — `src/lib/comites.functions.ts`

### 1a. Estender `updatePautaItem`
Trocar o `inputValidator` por:
```ts
z.object({
  id: z.string().uuid(),
  relator_id: z.string().uuid().nullable().optional(),
  decisao: z.enum(["aprovado","aprovado_com_ressalvas","reprovado","adiado","pendente"]).optional(),
  justificativa: z.string().max(4000).nullable().optional(),
  condicionantes: z.string().max(4000).nullable().optional(),
  estagio_sugerido: z.string().max(120).nullable().optional(),
})
```
No handler, montar o `patch` condicional para cada campo presente (mesmo padrão do `relator_id` atual). `updateComite` permanece intocado (continua bloqueando `realizado`).

### 1b. Nova `realizarComite`
`POST` + `requireSupabaseAuth`. Input: `{ id: uuid, ata_consolidada?: string|null (max 20000) }`.
Fluxo:
1. Carregar `select status, ata_consolidada, criado_por_id from comites where id=...` (`before`). Se não existir → erro.
2. **Checagem de permissão** (admin / líder / criador):
   ```ts
   const { data: me } = await supabaseAdmin
     .from("profiles").select("role").eq("id", context.userId).single();
   const allowed =
     me?.role === "admin" || me?.role === "lider" || before.criado_por_id === context.userId;
   if (!allowed) throw new Error("Sem permissão para realizar este comitê.");
   ```
3. Se `before.status !== 'preparacao'` → "Só é possível realizar um comitê em preparação."
4. `select decisao from comite_pauta where comite_id=...`. Se vazio → "Adicione ao menos um projeto à pauta antes de realizar." Se algum item tem `decisao` `null`/`'pendente'` → "Registre a decisão de todos os projetos antes de realizar o comitê."
5. `update comites set status='realizado', ata_consolidada = data.ata_consolidada ?? before.ata_consolidada where id=...`.
6. `return { ok: true }`.

## 2) UI — `src/routes/_authenticated/comites/$id.tsx`

### 2a. Botão "Realizar comitê"
Renderizado ao lado de "Cancelar comitê" quando `canEdit && isPreparacao`. Abre o modo de registro.

### 2b. Modo de registro de decisões
Estado local `mode: "view" | "registro"`. Em `registro`, substitui o card "Pauta" por uma versão editável. Para cada item:
- Cabeçalho reusa o layout atual (nome + Badge tipo + Badge estágio).
- `Select` Decisão (5 opções, labels pt-BR conforme prompt).
- `Textarea` Justificativa (`onBlur` salva).
- `Textarea` Condicionantes (placeholder "Uma condicionante por linha — viram tarefas depois.", `onBlur` salva).
- `Select` Estágio sugerido — opções derivadas de `item.projeto_tipo === "ma" ? MA_CONFIG.estagioLabels : NN_CONFIG.estagioLabels` (importar de `@/lib/projetos-config`) + opção "Manter estágio atual" (`null`).
- Persistência via `updatePautaItem` (mutation única `pautaItemM` parametrizada). Invalida `["comite", id]` no sucesso. Optimistic local state para evitar perda do que está sendo digitado.

Rodapé com botões "Voltar" e "Concluir comitê".

### 2c. Concluir comitê
Ao clicar "Concluir":
1. Validação client-side: se algum item ainda está `pendente`/sem decisão → `toast.error` com a mesma mensagem e impede.
2. Compor `ataMarkdown` no cliente (template do prompt) usando `formatDataBR` simplificado (sem hora) e os labels finais.
3. Abrir `Dialog` de confirmação com `Textarea` (`defaultValue = ataMarkdown`, editável, `min-h-[260px]`).
4. Confirmar → `realizarComite({ id, ata_consolidada })`. `toast.success("Comitê realizado.")`. Invalidar `["comite", id]` e `["comites"]`. Sair do modo registro. Abrir automaticamente o dialog 2e se houver condicionantes.

### 2d. Visualização pós-realizado
Quando `status !== 'preparacao'`:
- Banner amber atual permanece.
- Cada item renderiza badge de decisão com cores:
  - `aprovado` → `bg-primary/15 text-primary`
  - `aprovado_com_ressalvas` → `bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300`
  - `reprovado` → `bg-destructive/15 text-destructive`
  - `adiado` → `bg-muted text-muted-foreground`
  - `pendente` → `variant="outline"`
- Mostrar Justificativa, Condicionantes (cada um em bloco de texto pequeno, oculto se vazio), e Estágio sugerido (texto traduzido pelo `estagioLabels` correspondente).
- Novo `Card` "Ata consolidada" abaixo da pauta, com `<pre className="whitespace-pre-wrap text-sm">{ata}</pre>` e dois `Button`s:
  - "Copiar ata" → `navigator.clipboard.writeText(ata)` + toast.
  - "Baixar .md" → `Blob([ata], { type: "text/markdown" })` + `URL.createObjectURL` + `<a download>` programático, nome `ata-{slug(titulo)}.md` (slug simples local).

### 2e. Dialog "Transformar condicionantes em tarefas"
Disponível ao concluir e via botão "Gerar tarefas de condicionantes" no Card da ata quando `status === 'realizado'`, usuário é admin/líder/criador, e existir ao menos 1 condicionante.

Conteúdo:
- Varrer `comite.pauta`, quebrar `condicionantes` por `\n`, ignorar linhas vazias/trim. Cada linha = candidata `{ id: gerado, projeto_id, projeto_nome, titulo: linha, incluir: true, responsavel_id: "", prazo: "", prioridade: "media" }`.
- Lista rolável: linha por linha mostrando `Checkbox incluir`, `projeto_nome` (read-only label), `titulo` (Input editável), `Select` responsável (`profileOptions`, obrigatório se incluído), `Input type=date` prazo (obrigatório), `Select` prioridade (baixa/média/alta).
- Botão "Criar N tarefas" desabilitado até toda candidata incluída ter responsável + prazo.
- Submit → `createTarefasBatch({ data_reuniao: comite.data.slice(0,10), tarefas: selecionadas.map(c => ({ projeto_id, titulo, responsavel_ids: [c.responsavel_id], prazo, prioridade })) })`. `toast.success("{n} tarefas criadas.")`. Fecha o dialog.

## Detalhes técnicos

- Imports novos na rota: `Textarea` (`@/components/ui/textarea`), `Checkbox` (`@/components/ui/checkbox`), `Input` (`@/components/ui/input`), `MA_CONFIG`/`NN_CONFIG` (`@/lib/projetos-config`), `realizarComite` (export novo), `createTarefasBatch` (`@/lib/tarefas.functions`).
- Permissão para abrir registro/dialog de tarefas: reutilizar a regra de `canEdit` atual (admin/líder/criador). Após `realizado`, expor a regra equivalente para o botão de gerar tarefas (sem o gate `isPreparacao`).
- Reuso total dos componentes UI existentes; sem libs novas (sem markdown renderer — `<pre>` resolve).
- Slug local: `titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")`.

## Checklist (executar antes de finalizar)

- [ ] `updatePautaItem` salva decisão/justificativa/condicionantes/estágio e relator continua funcionando.
- [ ] "Realizar comitê" só aparece em preparação e para admin/líder/criador.
- [ ] `realizarComite` rejeita usuário sem permissão (admin/líder/criador) no servidor.
- [ ] Concluir bloqueado se houver decisão pendente (mensagem clara).
- [ ] Após concluir: status `realizado`, ata salva, pauta read-only, banner.
- [ ] Badges com cores corretas.
- [ ] Copiar ata e baixar `.md` funcionam.
- [ ] Condicionantes viram tarefas e aparecem em Tarefas.
- [ ] Cancelar e fluxo de preparação intactos.
- [ ] OK em mobile (textareas em coluna, dialog rolável).
