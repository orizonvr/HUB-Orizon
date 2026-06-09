# HUB Orizon — Pipeline de Alocação de Capital

Aplicação web interna da **Orizon (OrizonVR)** para acompanhar o pipeline de
**M&A** e **Novos Negócios**: projetos, estágios, tarefas, comitês de decisão,
documentos e notificações — com dashboard consolidado para a diretoria.

---

## Visão geral

- **App full-stack com SSR** (renderização no servidor) construído em **TanStack Start**.
- **Banco de dados + autenticação** no **Supabase** (PostgreSQL com RLS).
- **Edição** feita na plataforma **Lovable**; **versionamento** no **GitHub**;
  **publicação** na **Azure**. Fluxo:

  ```
  Lovable (criar/editar)  →  GitHub (versionar)  →  Azure (publicar/rodar)
  ```

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework / SSR | TanStack Start + TanStack Router + TanStack Query |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix), Recharts, lucide-react |
| Formulários / validação | react-hook-form + Zod |
| Backend (server functions) | `createServerFn` (TanStack) + middleware de auth Supabase |
| Banco / Auth / Storage | Supabase (PostgreSQL, RLS, Auth, Storage) |
| E-mail | Resend (API oficial) |
| Build | Vite (via `@lovable.dev/vite-tanstack-config`, que embute o **Nitro**) |
| Hospedagem | **Azure App Service** (Linux, **Node 22**) |
| CI/CD | GitHub Actions (build + deploy automáticos) |
| Gerenciador de pacotes | **Bun** (lockfile `bun.lock`) |

## Modelo de build — o "interruptor" `BUILD_TARGET`

O mesmo código gera **dois alvos diferentes**, controlados pela variável de
ambiente `BUILD_TARGET` (ver [`vite.config.ts`](vite.config.ts)):

| Contexto | `BUILD_TARGET` | Resultado |
|---|---|---|
| **Lovable / dev local** | (ausente) | Comportamento padrão da Lovable (Nitro preset `cloudflare-module`). Preview/edição na plataforma seguem normais. |
| **GitHub Actions → Azure** | `node` | Nitro com preset **`node-server`**, gerando um servidor Node autônomo em **`dist/server/index.mjs`**. |

> O diretório de saída é **fixado em `dist/`** no `vite.config.ts` para não
> depender da versão do plugin da Lovable (que já mudou o padrão entre versões).

## O que é preciso para funcionar

1. **Node 22 LTS** (requisito do Vite 7) e **Bun** para instalar dependências.
2. Um projeto **Supabase** com o schema aplicado (ver
   [`supabase/migrations/`](supabase/migrations) ou o script consolidado em `SQL/`).
3. As **variáveis de ambiente** abaixo.

### Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `SUPABASE_URL` | runtime (Azure) | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | runtime | Chave pública/anon (valida o login) |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **Segredo** — acesso admin (server functions) |
| `VITE_SUPABASE_URL` | **build** (GitHub Actions) | URL embutida no bundle do navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **build** | Chave anon embutida no navegador |
| `VITE_SUPABASE_PROJECT_ID` | **build** | ID do projeto Supabase |
| `RESEND_API_KEY` | runtime | **Segredo** — envio de e-mails (opcional) |
| `EMAIL_FROM` | runtime | Remetente dos e-mails |
| `APP_BASE_URL` | runtime | URL pública (links de e-mail) |
| `CRON_SECRET` | runtime | **Segredo** — autentica o cron de tarefas |
| `BUILD_TARGET` | **build (CI)** | `node` apenas no pipeline Azure |

> ⚠️ As variáveis **`VITE_*`** são embutidas no JavaScript **no momento do build** —
> precisam existir no **GitHub Actions**, não só no runtime da Azure. As demais
> são lidas em tempo de execução pelo servidor. Veja o modelo em
> [`.env.example`](.env.example).

## Rodar localmente

```bash
bun install

# Desenvolvimento (hot reload) — http://localhost:8080
bun run dev

# Build de produção igual ao da Azure (Node) — gera dist/server/index.mjs
bun run build:node
node --env-file=.env dist/server/index.mjs   # sobe em http://localhost:3000
```

## Estrutura do projeto

```
src/
  routes/                  # páginas e rotas (TanStack Router, file-based)
  components/              # componentes de UI (ui/ = shadcn)
  lib/*.functions.ts       # server functions (acesso ao banco via Supabase)
  integrations/supabase/   # clients Supabase (browser e server/admin)
supabase/migrations/       # schema do banco (SQL versionado)
SQL/                       # scripts consolidados (schema + carga de dados)
.github/workflows/         # CI/CD (deploy para a Azure)
docs/                      # documentação (ver ARQUITETURA-E-DEPLOY.md)
```

## Deploy

A publicação é **automática**: cada `push` na branch `main` dispara o workflow
[`deploy-homol.yml`](.github/workflows/deploy-homol.yml), que builda no modo Node
e publica no Azure App Service.

📘 **Detalhes completos da arquitetura e da configuração** (Azure, Supabase,
secrets, passo a passo para recriar o ambiente) em
[`docs/ARQUITETURA-E-DEPLOY.md`](docs/ARQUITETURA-E-DEPLOY.md).
