# Ajustes em Novos Negócios e Dashboard

Sete blocos de mudança, todos confirmados contra o código atual. Uma única alteração de banco (nova coluna `periodo_total_anos`).

## 1. Badge de status nos cards (Novos Negócios)

No workspace de projetos, cards do Kanban e da visão Cards passam a exibir um badge com o status (Ativo / Pausado / Concluído / Cancelado) ao lado do nome, apenas quando o tipo é Novos Negócios. A tabela fica intacta.

## 2. Barra de rolagem horizontal no topo do Kanban

Hoje o Kanban tem só a barra nativa embaixo (`overflow-x-auto`). Será adicionada uma barra fina (~12px) acima das colunas, espelhando a largura total do conteúdo, com sincronização bidirecional de scroll (refs + guard anti-loop) e recálculo de largura quando colunas/projetos mudam. Vale para M&A e NN, já que o componente é compartilhado. Estilo discreto usando tokens `--border` / `--muted`.

## 3. Visão Geral: labels e tarefas

- "Fechamento real" vira "Fechamento Realizado" no painel lateral e nas duas ocorrências do dossiê (texto do markdown e o campo exibido). Campo do banco inalterado.
- "Próximos Passos" no painel: hoje mostra só a primeira tarefa aberta; passa a listar todas as tarefas abertas (status diferente de concluída e cancelada), com título e prazo.
- No dossiê, o card "Tarefas abertas" ganha botão "+ Nova tarefa" (dialog existente) e edição ao clicar na tarefa (drawer existente). Após criar/editar, a query `["tarefas-projeto", id]` é invalidada, atualizando card e Próximos Passos.

## 4. Labels financeiros de Novos Negócios + novo campo

Renomeações (somente rótulos, no painel, dossiê e comparar targets):

- Volume Ano 3 → Volume Total (unid.)
- Receita Líquida Ano 3 → Receita Líquida Total (R$)
- EBITDA Ano 3 → EBITDA Total (R$)
- CAPEX Total Nominal (R$) → CAPEX Total Projeto (R$)
- Valor Presente — Taxa (%) → Valor Presente — Taxa (IPCA + %)

Além disso:

- Remover o campo "CAPEX Tecnologia (R$)" da interface (input e exibições). A coluna `capex_tecnologia` permanece no banco.
- Novo campo editável "Período Total do Projeto (anos)" na seção Valuation, salvo em uma nova coluna.

## 5. Tipos de documento (Novos Negócios)

- "Premissas Recebidas" → "Informações Recebidas"
- "Modelo Inicial" → "Materiais Iniciais"

Documentos já salvos continuam mostrando o texto antigo; nada é migrado.

## 6. Dashboard — KPIs de Novos Negócios

Com o toggle em "Novos Negócios", considerando apenas projetos ativos:

- "Pipeline agregado" passa a somar CAPEX Total Projeto, com hint "CAPEX Total Projeto (ativos)".
- Dois KPIs novos: "Receita Líquida Total" e "EBITDA Total".

As visões "Tudo" e "M&A" mantêm os KPIs atuais.

## 7. Dashboard — Pipeline por estágio de NN (bug)

O dashboard ainda usa estágios antigos de NN (`analise_viabilidade`, `aprovacao_comite`), que não existem mais. Correção:

- Usar os estágios reais vindos da constante compartilhada de NN.
- Na visão Novos Negócios, exibir nesta ordem: Discussões Iniciais, Modelagem Inicial, Discussões com Offtaker, Discussões com Fornecedores, Materiais Finais, Implementação e Operação (duas últimas somadas numa barra). "Paralisados" não aparece.
- Na visão "Tudo", remapear os buckets consolidados: discussões iniciais + modelagem inicial → Originação; offtaker + fornecedores → Proposta / Offtaker; materiais finais → Negociação; implementação + operação → Implementação / Operação.

## Detalhes técnicos

Arquivos tocados:

- `src/components/projetos/projetos-workspace.tsx` — badge de status (Kanban/Cards) + barra de scroll superior sincronizada.
- `src/components/ma/project-sheet.tsx` — label de fechamento, `ProximosPassosReadOnly` completo, labels financeiros NN, remoção de CAPEX Tecnologia, novo campo de período.
- `src/routes/_authenticated/projetos/$id.tsx` — labels, remoção de CAPEX Tecnologia, criação/edição de tarefas no card.
- `src/components/projetos/comparar-targets.tsx` — labels e remoção de CAPEX Tecnologia.
- `src/lib/ma-utils.ts` — `TIPO_DOCUMENTO_NN`.
- `src/lib/projetos-types.ts`, `src/lib/projetos.functions.ts`, `src/integrations/supabase/types.ts` — novo campo `periodo_total_anos` no type, select e campos atualizáveis.
- `src/lib/dashboard.functions.ts` e `src/routes/_authenticated/index.tsx` — KPIs NN, select ampliado (`capex_total_nominal`, `receita_projetada_ano3`, `ebitda_ano3`) e correção dos estágios/buckets.

Migration única:

```sql
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS periodo_total_anos numeric NULL;
```

Nada de mudança em M&A fora dos pontos citados, nem em comitês, notificações, convites ou auth.

## Validação

Rodar typecheck/build e conferir: badge de status nos cards NN; scroll superior funcionando nos dois sentidos em M&A e NN; dossiê com "Fechamento Realizado", lista completa de próximos passos e criação/edição de tarefa; painel financeiro NN com labels novos, sem CAPEX Tecnologia e com o período salvando; tipos de documento NN atualizados; dashboard NN com novos KPIs e gráfico em 6 grupos; dashboard "Tudo"/"M&A" sem regressão.
