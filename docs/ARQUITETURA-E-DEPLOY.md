# Arquitetura & Deploy — HUB Orizon

Registro da arquitetura montada e do **passo a passo do que foi configurado** para
colocar o app no ar. Serve como referência para manter, recriar ou evoluir o ambiente.

> Documento complementar ao [`README.md`](../README.md) (visão geral técnica).
> O arquivo `MIGRACAO-AZURE.md` neste mesmo diretório é o histórico inicial da migração;
> **este documento é a referência atualizada**.

---

## 1. Arquitetura em uma imagem

```
   ┌────────────┐   commit    ┌────────────────────────┐   deploy    ┌──────────────────────┐
   │  Lovable   │ ──────────▶ │  GitHub                │ ──────────▶ │  Azure App Service   │
   │ (edição)   │             │  orizonvr/HUB-Orizon   │  (Actions)  │  orizon-pipeline-homol│
   └────────────┘             └────────────────────────┘             └──────────┬───────────┘
                                                                                 │ consultas
                                                                                 ▼
                                                                      ┌──────────────────────┐
                                                                      │  Supabase            │
                                                                      │  (projeto orizon-deals)│
                                                                      │  PostgreSQL + Auth    │
                                                                      └──────────────────────┘
```

- **Lovable** edita o código e comita no GitHub. Não fala direto com a Azure.
- **GitHub Actions** builda em modo Node e publica na Azure a cada push na `main`.
- **Azure App Service** roda o servidor Node (SSR) e atende os usuários.
- **Supabase** guarda os dados e a autenticação.

## 2. Componentes e identificadores

| Componente | Identificação |
|---|---|
| Repositório | `github.com/orizonvr/HUB-Orizon` (branch `main`) |
| Azure — Resource Group | `rg-orizon-pipeline` |
| Azure — App Service | `orizon-pipeline-homol` (Linux, Node 22) — homologação |
| URL pública | `https://orizon-pipeline-homol.azurewebsites.net` |
| Supabase | projeto **orizon-deals** (ambiente controlado da org) |
| Workflow CI/CD | `.github/workflows/deploy-homol.yml` |

---

## 3. Passo a passo do que foi feito/configurado

### 3.1. Ajustes no código (para rodar fora da Lovable)

1. **Build Node** — [`vite.config.ts`](../vite.config.ts): com `BUILD_TARGET=node`,
   usa Nitro `node-server` e fixa a saída em `dist/` (`output.dir/serverDir/publicDir`).
   Sem a variável, mantém o comportamento Lovable (não quebra o preview).
2. **Entry padrão no build Node** — o wrapper `src/server.ts` (formato Cloudflare
   Worker) **não** é usado no build Node, pois é incompatível com o `node-server`
   (quebrava em `new URL("/")`). No modo Node usa-se o entry padrão do TanStack Start.
3. **E-mail via Resend** — [`src/lib/notificacoes.server.ts`](../src/lib/notificacoes.server.ts):
   envia direto pela API oficial `https://api.resend.com/emails` (só `RESEND_API_KEY`),
   substituindo o gateway interno da Lovable. Sem a chave, o envio é pulado (app não quebra).
4. **`package.json`** — scripts `build:node` (`cross-env BUILD_TARGET=node vite build`)
   e `start` (`node dist/server/index.mjs`); devDependency `cross-env`.
5. **Segurança** — `.gitignore` ignora `.env`; modelo em `.env.example`.

### 3.2. CI/CD — GitHub Actions (`deploy-homol.yml`)

Dispara em `push` na `main` (e manualmente). Etapas:
1. Checkout.
2. **Setup Bun** + `bun install --frozen-lockfile` (usa o `bun.lock`, mantido pela Lovable).
3. `bun run build:node` (com as `VITE_*` vindas dos **secrets** do GitHub).
4. Empacota só o necessário (`dist/` + `package.json`) — o `dist/server` é standalone.
5. `azure/webapps-deploy@v3` publica no App Service `orizon-pipeline-homol`.

> **Por que Bun no CI:** a Lovable usa Bun e mantém o `bun.lock` atualizado. Usar o
> mesmo gerenciador evita o lockfile dessincronizar (problema que o `npm ci` teria).

**Secrets necessários no GitHub** (`Settings → Secrets and variables → Actions`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
`AZURE_WEBAPP_PUBLISH_PROFILE` (XML do publish profile do App Service).

### 3.3. Azure App Service

- Criado em `rg-orizon-pipeline`, **Linux / Node 22**, plano B1.
- **Startup Command:** `npm start`
- **Always On:** ligado | **SCM Basic Auth:** ligado
- **App setting** `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (o build acontece no Actions).
- **Variáveis de runtime** (App settings) — ver seção 4.

Comando de referência (Azure CLI / Cloud Shell):
```bash
az webapp config appsettings set \
  --resource-group rg-orizon-pipeline \
  --name orizon-pipeline-homol \
  --settings \
    SUPABASE_URL="https://<REF>.supabase.co" \
    SUPABASE_PUBLISHABLE_KEY="<anon>" \
    SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

### 3.4. Supabase (projeto orizon-deals)

1. **Schema:** rodar o script consolidado `SQL/schema-orizon-deals.sql` no SQL Editor.
   Ele vem das migrations em `supabase/migrations/`, **exceto** as 2 de `pg_cron`/`pg_net`
   (o agendamento é feito via GitHub Actions, não no banco).
2. **Dados:** rodar `SQL/dados-projetos-orizon-deals.sql` (carrega os projetos a partir
   do CSV fonte, mapeando rótulos → chaves internas do app).
3. **Usuário/login:** Authentication → Add user. O **primeiro** usuário criado vira
   **admin/ativo** automaticamente (trigger `handle_new_user`).
4. **Redirect URLs:** Authentication → URL Configuration → adicionar
   `https://orizon-pipeline-homol.azurewebsites.net/**`.

### 3.5. Cron de notificações (pendente)

O endpoint `/api/public/hooks/notify-tarefas` envia e-mails de tarefas vencendo.
O agendamento será um **workflow agendado no GitHub Actions** (cron `0 11 * * *` =
08h SP) que faz `POST` no endpoint com o header `Authorization: Bearer <CRON_SECRET>`.
> _Status: a montar._

---

## 4. Variáveis de ambiente (referência)

| Variável | Onde vive | Obrigatória? | Observação |
|---|---|---|---|
| `SUPABASE_URL` | Azure (runtime) | Sim | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Azure (runtime) | Sim | chave anon (legada `eyJ...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Azure (runtime) | Sim | **segredo** — usar a **legada `eyJ...`** |
| `VITE_SUPABASE_URL` | GitHub (build) | Sim | embutida no navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub (build) | Sim | embutida no navegador |
| `VITE_SUPABASE_PROJECT_ID` | GitHub (build) | Sim | ref do projeto |
| `RESEND_API_KEY` | Azure (runtime) | Não | só para e-mails |
| `EMAIL_FROM` | Azure (runtime) | Não | remetente |
| `APP_BASE_URL` | Azure (runtime) | Recomendada | URL pública |
| `CRON_SECRET` | Azure (runtime) | Só p/ cron | segredo do agendador |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | GitHub (secret) | Sim | credencial de deploy |

> **Regra de ouro das chaves Supabase:** `URL`, `anon` e `service_role` precisam ser
> **todas do mesmo projeto**. Usar as chaves **legadas (`eyJ...`)** — o app espera esse
> formato (as novas `sb_*` não furaram o RLS no `service_role`).

---

## 5. Operações comuns

- **Publicar uma alteração:** editar no Lovable → commit na `main` (automático) →
  o Actions builda e publica. (Ou `git push` direto na `main`.)
- **Trocar uma credencial de runtime:** `az webapp config appsettings set ...` →
  o App Service reinicia. Se persistir o valor antigo, reiniciar manualmente:
  `az webapp restart -g rg-orizon-pipeline -n orizon-pipeline-homol`.
- **Trocar uma `VITE_*`:** alterar o secret no GitHub e **re-rodar o workflow**
  (Actions → último run → *Re-run all jobs*) — elas só mudam via rebuild.
- **Ver erros do servidor:** App Service → Monitoring → **Log stream**.

## 6. Decisões e lições aprendidas

- **Cloudflare → Node:** o projeto Lovable buildava para Cloudflare Workers, que não
  roda no App Service. Solução: alvo Node via Nitro, com interruptor `BUILD_TARGET`.
- **Saída fixada em `dist/`:** a versão do plugin Lovable mudou o diretório padrão
  (`dist/` → `.output/`); fixar evita quebrar o `start`/deploy a cada atualização.
- **Bun no CI:** alinhado ao lockfile que a Lovable mantém, evita dessincronização.
- **Chaves Supabase legadas:** o app espera as chaves JWT legadas; as novas `sb_*` não
  bypassaram o RLS no acesso admin (telas vinham vazias sem erro).
- **Projeto Supabase consistente:** misturar URL de um projeto com chave de outro
  causa "login ok, dados vazios". Tudo precisa ser do mesmo projeto.
- **Ambiente controlado (orizon-deals):** como o Supabase original do Lovable estava
  inacessível, recriou-se o schema (via migrations) e os dados (via CSV) num projeto
  ao qual a equipe tem acesso.

## 7. Pendências / próximos passos

- [ ] Apontar as 6 variáveis (runtime + build) para o projeto **orizon-deals** e rebuild.
- [ ] Criar o usuário admin no orizon-deals e validar login + dados na Azure.
- [ ] Montar o workflow de **cron** (notificações de tarefas).
- [ ] (Opcional) Verificar **domínio próprio** no Resend para e-mails corporativos.
- [ ] (Produção) Avaliar App Service dedicado de produção + domínio custom + Key Vault
      para os segredos.
- [ ] Reconectar/validar o **Lovable** apontando para `orizonvr/HUB-Orizon` + orizon-deals.
