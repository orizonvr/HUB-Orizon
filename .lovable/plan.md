## Fix: criação de projetos novos no commitImportPlannerXlsx

Escopo: APENAS o bloco "1) Criar projetos novos" em `src/lib/import-planner-xlsx.functions.ts`. Nada de migration, nada de mudança em outros arquivos.

### Mudanças

1. **Carregar projetos existentes uma vez no commit** (com `id, nome, tipo, estagio`). Hoje o commit não carrega — só o preview carrega. Vamos buscar logo antes do bloco de criação de projetos novos para poder derivar um `estagio` válido por tipo.

2. **Derivar `estagio` válido por tipo** sem hardcodar:
   - `estagioPorTipo = { ma: <estagio de algum projeto existente tipo=ma>, novos_negocios: <idem> }`
   - Fallback se não houver nenhum projeto daquele tipo: `"avaliacao_inicial"` para `ma`, `"validacao"` para `novos_negocios`.

3. **Remover `criado_por_id`** do insert de projetos. Inserir exatamente:
   ```ts
   {
     tipo: p.tipo,
     nome: p.nome,
     status: p.status,
     responsavel_id: context.userId,
     estagio: estagioPorTipo[p.tipo],
   }
   ```

4. **Manter** todo o resto: o `select("id, nome")` pós-insert, o `projetoIdPorBucket`, o `projetosCriadosIds`, e o rollback (`delete().in("id", projetosCriadosIds)`) em caso de erro no insert de tarefas — sem alterações.

### Diff conceitual (apenas o trecho ~L286-L316)

```ts
// novo: carregar projetos existentes para derivar estagio válido
const { data: projetosExistentes } = await supabaseAdmin
  .from("projetos")
  .select("id, nome, tipo, estagio");
const estagioPorTipo: Record<"ma" | "novos_negocios", string> = {
  ma:
    (projetosExistentes ?? []).find((p) => p.tipo === "ma")?.estagio ??
    "avaliacao_inicial",
  novos_negocios:
    (projetosExistentes ?? []).find((p) => p.tipo === "novos_negocios")?.estagio ??
    "validacao",
};

if (data.novos_projetos.length > 0) {
  const insertRows = data.novos_projetos.map((p) => ({
    nome: p.nome,
    tipo: p.tipo,
    status: p.status,
    responsavel_id: context.userId,
    estagio: estagioPorTipo[p.tipo],
    // criado_por_id REMOVIDO — coluna não existe
  }));
  // ...resto idêntico
}
```

### Fora de escopo
- Nenhuma migration.
- Nenhuma mudança em `previewImportPlannerXlsx`, no dialog, ou em qualquer outro arquivo.
- Insert de tarefas e rollback permanecem como estão.
