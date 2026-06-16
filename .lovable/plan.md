## Contexto

O preview está quebrado com `Missing Supabase environment variable(s)`. O `supabase/config.toml` aponta para `xwpjinqwdjaiyoacowqz`, mas o projeto correto é `jyaiiywzzxebupfvcnbq` (Orizon HUB, org Orizon VR). Nenhum secret `SUPABASE_*` está provisionado neste Lovable — sinal de que o vínculo ainda não foi feito **para este projeto Lovable**, mesmo que a org tenha sido conectada.

## O que vou fazer (em build mode)

### 1. Reconectar Lovable Cloud ao projeto correto
- Abrir o fluxo de conexão do Lovable Cloud apontando para `jyaiiywzzxebupfvcnbq`.
- Isso provisiona automaticamente os secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e atualiza `supabase/config.toml` com o `project_id` certo.
- **Importante:** essa etapa exige uma ação tua na UI (selecionar o projeto Orizon HUB na lista). Vou disparar o prompt; você confirma.

### 2. Validar variáveis e config
- `fetch_secrets` para confirmar que `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` apareceram.
- Conferir que `supabase/config.toml` mudou para `project_id = "jyaiiywzzxebupfvcnbq"`.
- Conferir que o erro `Missing Supabase environment variable(s)` sumiu do console do preview.

### 3. Teste de conexão (read-only, sem mutação)
Rodar pelo terminal (psql gerenciado, sem alterar nada no banco):

```text
- SELECT current_database(), current_user, version()
- SELECT COUNT(*) FROM public.profiles
- SELECT COUNT(*) FROM public.projetos
- SELECT COUNT(*) FROM public.tarefas
- SELECT id, email FROM public.profiles WHERE email = 'renan.dipardi@orizonvr.com.br'
- \dT+ public.tarefa_status         -- confirma o enum real
- \dT+ public.projeto_status
```

Resultado esperado:
- conexão OK (DB name = `postgres`, projeto certo)
- contagens reais das três tabelas no Orizon HUB
- presença do profile fallback do importador
- enums reais (pra travar o mapeamento de `status`/`prioridade` na etapa de import)

### 4. Reportar
Te devolvo:
- ✅/❌ secrets provisionados
- ✅/❌ `config.toml` correto
- counts atuais de `profiles`, `projetos`, `tarefas` no Orizon HUB
- se `tarefas` está em 0 (pré-condição da importação) ou já tem dados (importação **abortada** — vamos investigar antes)
- enums reais comparados com o que `import-planner.functions.ts` assume

### 5. Próximo passo (fora deste plano)
Com a conexão validada e `tarefas` confirmado vazio, você abre `/admin-import`, roda o diagnóstico e me cola o JSON pra eu montar o payload aprovado.

## O que NÃO vou fazer agora
- não executo a importação
- não rodo migrations
- não mexo no schema
- não toco em `import-planner.functions.ts` (já está aprovado e correto)
