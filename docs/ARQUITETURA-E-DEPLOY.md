# Arquitetura & Deploy — HUB Orizon (Produção)

Registro da arquitetura em produção e do **passo a passo do que foi configurado** para
colocar o app no ar. Referência para manter, recriar ou evoluir o ambiente.

> Complementar ao [`README.md`](../README.md) (visão geral técnica).
> `MIGRACAO-AZURE.md` é o histórico inicial da migração; **este é a referência atual**.

---

## 1. Arquitetura em uma imagem

```
   ┌────────────┐   commit    ┌────────────────────────┐   deploy    ┌──────────────────────────┐
   │  Lovable   │ ──────────▶ │  GitHub                │ ──────────▶ │  Azure App Service       │
   │ (edição)   │             │  orizonvr/HUB-Orizon   │ (Actions/   │  HUB-Orizon (Linux/Node22)│
   └────────────┘             └────────────────────────┘   npm)      └──────────┬───────────────┘
                                                                                 │ consultas
                                                                                 ▼
                                                                      ┌──────────────────────────┐
                                                                      │  Supabase                │
                                                                      │  projeto jyaiiywzzxebupfvcnbq│
                                                                      │  PostgreSQL + Auth        │
                                                                      └──────────────────────────┘
```

- **Lovable** edita o código e comita no GitHub. Não fala direto com a Azure.
- **GitHub Actions** builda em modo Node (com npm) e publica na Azure a cada push na `main`.
- **Azure App Service** roda o servidor Node (SSR) e atende os usuários.
- **Supabase** guarda os dados e a autenticação.

## 2. Componentes e identificadores (PRODUÇÃO)

| Componente | Identificação |
|---|---|
| Repositório | `github.com/orizonvr/HUB-Orizon` (branch `main`) |
| Azure — Subscription | `Azure subscription 1` |
| Azure — Resource Group | `rg-orizon-HUB` (região Brazil South) |
| Azure — App Service Plan | `botRobOrizonProd` (Linux, **Basic B1**) |
| Azure — App Service (Web App) | `HUB-Orizon` (Linux, **Node 22 LTS**) |
| URL pública | `https://hub-orizon-d2hag0d9cbfyf4dk.brazilsouth-01.azurewebsites.net` |
| Supabase | projeto **`jyaiiywzzxebupfvcnbq`** (PostgreSQL + Auth) |
| Workflow CI/CD | `.github/workflows/deploy.yml` |

---

## 3. Passo a passo do que foi feito/configurado

### 3.1. Ajustes no código (para rodar fora da Lovable)

1. **Build Node** — [`vite.config.ts`](../vite.config.ts): com `BUILD_TARGET=node`,
   usa Nitro `node-server` e **fixa a saída em `dist/`** (`output.dir/serverDir/publicDir`).
   Sem a variável, mantém o comportamento Lovable (não quebra o preview).
2. **Entry padrão no build Node** — o wrapper `src/server.ts` (formato Cloudflare
   Worker) **não** é usado no build Node, pois é incompatível com o `node-server`
   (quebrava em `new URL("/")`). No modo Node usa-se o entry padrão do TanStack Start.
3. **E-mail via Resend** — [`src/lib/notificacoes.server.ts`](../src/lib/notificacoes.server.ts):
   envia direto pela API oficial `https://api.resend.com/emails` (só `RESEND_API_KEY`).
   Sem a chave, o envio é pulado (app não quebra).
4. **`package.json`** — scripts `build:node` e `start` (`node dist/server/index.mjs`);
   devDependency `cross-env`.
5. **Segurança** — `.gitignore` ignora `.env`; modelo em `.env.example`.

### 3.2. CI/CD — GitHub Actions (`deploy.yml`)

Dispara em `push` na `main` (e manualmente, via *Run workflow*). Etapas:
1. Checkout.
2. **Setup Node 22** + `npm install`.
3. `npm run build` com **`BUILD_TARGET=node` no ambiente do step** (+ as `VITE_*` dos secrets).
4. **Verifica** que `dist/server/index.mjs` foi gerado e **empacota em `app.zip`**
   (somente `dist/` + `package.json` — o `dist/server` é standalone).
5. `azure/webapps-deploy@v3` publica no App Service `HUB-Orizon`.

> **Por que npm (e não bun) no CI:** com `bun`, o `BUILD_TARGET=node` não era propagado
> e o build saía como **Cloudflare** (`wrangler.json`/`index.js`), que não roda no Node.
> Com **npm**, o build gera corretamente o `dist/server/index.mjs`. (Ver seção 6.)

**Secrets no GitHub** (`Settings → Secrets and variables → Actions`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
`AZURE_WEBAPP_PUBLISH_PROFILE` (XML do publish profile do `HUB-Orizon`).

### 3.3. Azure App Service (`HUB-Orizon`)

- Criado em `rg-orizon-HUB`, **Linux / Node 22 LTS**, plano `botRobOrizonProd` (B1).
- **Startup Command:** `npm start`
- **Always On:** ligado | **SCM Basic Auth:** ligado
- **App setting** `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (o build acontece no Actions).
- **Variáveis de runtime** (App settings) — ver seção 4.

Comando de referência (Azure CLI / Cloud Shell — **tudo em uma linha**):
```bash
az webapp config appsettings set --resource-group rg-orizon-HUB --name HUB-Orizon --settings SUPABASE_URL="https://jyaiiywzzxebupfvcnbq.supabase.co" SUPABASE_PUBLISHABLE_KEY="<anon eyJ>" SUPABASE_SERVICE_ROLE_KEY="<service_role eyJ>" SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

### 3.4. Supabase (projeto `jyaiiywzzxebupfvcnbq`)

1. **Schema:** rodar `SQL/schema-orizon-deals.sql` no SQL Editor (vem das migrations
   em `supabase/migrations/`, **exceto** as 2 de `pg_cron`/`pg_net`).
2. **Dados:** rodar `SQL/dados-projetos-orizon-deals.sql` (carrega os 51 projetos).
3. **Usuário/login:** Authentication → Add user. O **primeiro** usuário criado vira
   **admin/ativo** automaticamente (trigger `handle_new_user`).
4. **Redirect URLs:** Authentication → URL Configuration → adicionar
   `https://hub-orizon-d2hag0d9cbfyf4dk.brazilsouth-01.azurewebsites.net/**`.

### 3.5. Cron de notificações (pendente)

O endpoint `/api/public/hooks/notify-tarefas` envia e-mails de tarefas vencendo.
O agendamento será um **workflow agendado no GitHub Actions** (cron `0 11 * * *` =
08h SP) que faz `POST` no endpoint com `Authorization: Bearer <CRON_SECRET>`.
> _Status: a montar._

---

## 4. Variáveis de ambiente (referência)

| Variável | Onde vive | Obrigatória? | Observação |
|---|---|---|---|
| `SUPABASE_URL` | Azure (runtime) | Sim | `https://jyaiiywzzxebupfvcnbq.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Azure (runtime) | Sim | chave anon (legada `eyJ...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Azure (runtime) | Sim | **segredo** — legada `eyJ...` |
| `VITE_SUPABASE_URL` | GitHub (build) | Sim | embutida no navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub (build) | Sim | embutida no navegador |
| `VITE_SUPABASE_PROJECT_ID` | GitHub (build) | Sim | `jyaiiywzzxebupfvcnbq` |
| `BUILD_TARGET` | GitHub (env do step) | Sim (CI) | `node` |
| `RESEND_API_KEY` | Azure (runtime) | Não | só para e-mails |
| `EMAIL_FROM` | Azure (runtime) | Não | remetente |
| `APP_BASE_URL` | Azure (runtime) | Recomendada | URL pública |
| `CRON_SECRET` | Azure (runtime) | Só p/ cron | segredo do agendador |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | GitHub (secret) | Sim | credencial de deploy |

> **Regra de ouro das chaves Supabase:** `URL`, `anon` e `service_role` precisam ser
> **todas do mesmo projeto** e no formato **legado (`eyJ...`)** — as novas `sb_*` não
> furaram o RLS no `service_role` (telas vinham vazias sem erro).

---

## 5. Operações comuns

- **Publicar uma alteração:** editar no Lovable → commit na `main` (automático) →
  o Actions builda e publica. (Ou `git push` direto na `main`.)
- **Trocar uma credencial de runtime:** `az webapp config appsettings set ...` →
  o App Service reinicia. Se persistir o valor antigo:
  `az webapp restart -g rg-orizon-HUB -n HUB-Orizon`.
- **Trocar uma `VITE_*`:** alterar o secret no GitHub e **re-rodar o workflow**
  (Actions → *Run workflow* / *Re-run all jobs*) — elas só mudam via rebuild.
- **Ver erros do servidor:** App Service → Monitoring → **Log stream**
  (habilitar antes: `az webapp log config -g rg-orizon-HUB -n HUB-Orizon --docker-container-logging filesystem`).

## 6. Decisões e lições aprendidas

- **Cloudflare → Node:** o projeto Lovable buildava para Cloudflare Workers, que não
  roda no App Service. Solução: alvo Node via Nitro, com interruptor `BUILD_TARGET`.
- **Saída fixada em `dist/`:** a versão do plugin Lovable mudou o diretório padrão
  (`dist/` → `.output/`); fixar evita quebrar o `start`/deploy a cada atualização.
- **npm no CI (não bun):** com `bun`, o `BUILD_TARGET` não ativava o modo Node e o
  build saía Cloudflare. Com `npm` + `BUILD_TARGET` no env do step, gera Node correto.
- **`BUILD_TARGET` no env do step:** não depender do `cross-env` no CI (foi fonte de
  falha quando rodado via bun).
- **Empacotar via zip + verificação:** o workflow valida que `dist/server/index.mjs`
  existe antes de publicar (falha cedo e claro) e envia um `app.zip` determinístico.
- **Chaves Supabase legadas e do mesmo projeto:** misturar URL de um projeto com chave
  de outro causa "login ok, dados vazios". Tudo do mesmo projeto, chaves `eyJ...`.

## 7. Pendências / próximos passos

- [ ] Montar o workflow de **cron** (notificações de tarefas).
- [ ] Configurar **`RESEND_API_KEY`** (+ domínio próprio no Resend) para e-mails.
- [ ] **Endurecer segredos:** migrar `SERVICE_ROLE_KEY`/`CRON_SECRET` para **Azure Key Vault**.
- [ ] **Domínio próprio** + TLS para a URL de produção (em vez de `azurewebsites.net`).
- [ ] **Rotacionar** a `service_role` (foi exposta durante a configuração).
- [ ] Confirmar o fluxo **Lovable → GitHub** (edições no Lovable comitando em `orizonvr/HUB-Orizon`).
