## Objetivo

Substituir o scaffold em branco atual de `/dev-server` pelo conteúdo do ZIP `HUB-Orizon-main.zip` para que o projeto Lovable passe a refletir 1:1 o repositório de produção. Após isso, o Lovable será usado somente para evoluir front-end (UI em `src/components` e camada visual de `src/routes`).

## O que o ZIP contém (verificado)

- Stack TanStack Start já configurado (`src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/routes/__root.tsx`, `src/routes/_authenticated/*`, `src/routes/api/public/hooks/*`).
- Integração Supabase em `src/integrations/supabase/` (client, client.server, auth-attacher, auth-middleware, types).
- Build/Deploy: `vite.config.ts` (com `BUILD_TARGET` Node/Azure), `package.json` + `bun.lock`, `wrangler.jsonc`, `tsconfig.json`, `bunfig.toml`, `components.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.env.example`.
- Banco: `supabase/config.toml` + `supabase/migrations/*` (24 migrations) e `SQL/schema-orizon-deals.sql`, `SQL/dados-projetos-orizon-deals.sql`.
- Documentação: `README.md`, `docs/ARQUITETURA-E-DEPLOY.md`, `docs/MIGRACAO-AZURE.md`, `.lovable/plan.md`.
- UI completa: `src/components/**` (app-sidebar, command-palette, ma/, comites/, tarefas/, projetos/, notificacoes/, ui/ shadcn etc.) e rotas `_authenticated/{index,tarefas,equipe,documentos,configuracoes,notificacoes,ma,novos-negocios,comites/*}.tsx`, além de `login.tsx` e `aceitar-convite.tsx`.

Observação: o ZIP NÃO contém `.github/workflows/` nem diretório `.git`. Nada será inventado — apenas o que existe será copiado.

## Plano de execução

1. Extrair `user-uploads://HUB-Orizon-main.zip` para `/tmp/horizon-extract/`.
2. Verificar que não há `.git` dentro do extraído (já confirmado na listagem) — segurança do repositório preservada.
3. Remover do `/dev-server` apenas os arquivos do scaffold inicial que serão substituídos pelo conteúdo do ZIP, mantendo `/dev-server/.git` intacto:
   - `rm -rf src/ supabase/ docs/ SQL/ .lovable/` e arquivos soltos do scaffold (`components.json`, `eslint.config.js`, `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, `.prettierrc`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.env.example`, `README.md`) caso existam.
4. Copiar tudo de `/tmp/horizon-extract/HUB-Orizon-main/` para `/dev-server/` com `rsync -a --exclude='.git' --exclude='.git/**'`, preservando estrutura, nomes e conteúdo exatamente como no ZIP.
5. Instalar dependências com `bun install --frozen-lockfile` para respeitar o `bun.lock` existente (nenhuma versão será alterada).
6. NÃO ativar Lovable Cloud, NÃO criar/conectar Supabase, NÃO mexer em variáveis de ambiente, CI/CD, `vite.config.ts`, `package.json`, `wrangler.jsonc`, `supabase/`, `src/server.ts` ou `src/integrations/`. Se o preview apresentar erros por falta de envs do Supabase, isso é esperado e será deixado como está.

## Restrições futuras (após a importação)

- Mudanças subsequentes ficam restritas a `src/components/**`, partes visuais de `src/routes/**` e estilos (`src/styles.css`, classes Tailwind).
- Não atualizar dependências, não tocar em build/deploy/CI, não criar migrations, não reconfigurar nada de backend.
