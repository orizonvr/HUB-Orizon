# Migração para Azure — OrizonVR | Pipeline

Documento de referência da migração do app **da hospedagem Lovable/Cloudflare para a Azure Cloud**, mantendo o Lovable apenas como ferramenta de **edição**.

> **Fluxo de trabalho permanente:**
> **Lovable** (criar/editar) → **GitHub** (versionar) → **Azure** (publicar e colocar no ar)

---

## 1. Por que a migração exige mudanças no código

O projeto foi gerado pela Lovable com duas amarras à plataforma dela:

1. **Build para Cloudflare Workers.** O pacote `@lovable.dev/vite-tanstack-config`
   injeta o plugin `@cloudflare/vite-plugin` durante o `vite build`. O resultado é
   um *Worker* da Cloudflare — formato que **não roda** num servidor Node comum
   da Azure.
2. **Envio de email via gateway da Lovable.** O código chamava
   `https://connector-gateway.lovable.dev/resend`, um proxy que só existe dentro
   da infraestrutura Lovable.

Esta etapa (Passos 1 e 2 abaixo) resolve essas duas amarras **sem quebrar o
Lovable** — a edição/preview na plataforma continua funcionando exatamente como
antes.

---

## 2. O que foi alterado (Passos 1 e 2)

### Passo 1 — Build Node (em vez de Cloudflare)

O `@lovable.dev/vite-tanstack-config` (v1.8.0, instalado) **já traz o Nitro
embutido** (`nitro/vite`, via dependência direta `nitro@3.0.260429-beta`) e
expõe a opção `nitro`. O preset padrão dentro do contexto Lovable é
`cloudflare-module`. Para gerar um servidor Node autônomo, basta pedir o preset
`node-server` ao próprio plugin — **não é preciso** instalar nenhum plugin Nitro
adicional.

**Arquivos alterados:**

| Arquivo | Mudança |
|---|---|
| [`vite.config.ts`](../vite.config.ts) | Quando `BUILD_TARGET=node`: (a) usa `nitro: { preset: "node-server" }` e (b) **não** usa o entry customizado `src/server.ts`. Sem a variável, mantém o comportamento Lovable (entry customizado + preset `cloudflare-module`). |
| [`package.json`](../package.json) | Nova devDependency `cross-env`. Novos scripts `build:node` e `start`. (O `nitro` vem junto com o plugin Lovable, não precisa declarar.) |

**Como o "interruptor" funciona** — tudo gira em torno da variável `BUILD_TARGET`:

- **Sem `BUILD_TARGET` (Lovable / dev local):** comportamento padrão da Lovable.
  Nada muda para quem edita no Lovable.
- **Com `BUILD_TARGET=node` (GitHub Actions → Azure):** build Node, gerando
  **`dist/server/index.mjs`**, iniciado com `node dist/server/index.mjs`
  (script `npm start`).

> **Por que isso não quebra o Lovable:** o Nitro/bundling só roda no `vite build`.
> O preview/edição da Lovable usa `vite dev`, que não é afetado.

> **⚠️ Detalhe importante — o entry customizado.** O projeto tem um
> [`src/server.ts`](../src/server.ts) que envolve o SSR para tratar erros do h3.
> Ele foi escrito no formato de **Cloudflare Worker** (`export default { fetch }`).
> Esse formato é **incompatível** com o adaptador `node-server` do Nitro: a
> requisição chega como objeto cru do Node (URL relativa `"/"`, sem `headers.get()`),
> quebrando em `new URL("/")` → erro 500 em todas as páginas. **Solução aplicada e
> testada:** no build Node, deixamos o TanStack Start usar o entry padrão dele
> (que integra corretamente com o Nitro/srvx). O wrapper de erro continua ativo no
> build Cloudflare/Lovable. *(Isso foi descoberto e corrigido testando o build
> localmente com Node 22.)*

**Scripts novos no `package.json`:**

```jsonc
"build:node": "cross-env BUILD_TARGET=node vite build", // build p/ Azure
"start": "node dist/server/index.mjs"                    // roda o servidor
```

> **Validado localmente** com Node v22.22.3: `npm run build:node` gera
> `dist/server/index.mjs`; `node --env-file=.env dist/server/index.mjs` sobe o
> servidor e `/login` e `/` respondem **200** sem erros.

### Passo 2 — Email via API oficial do Resend

**Arquivo alterado:** [`src/lib/notificacoes.server.ts`](../src/lib/notificacoes.server.ts)

- **Antes:** `POST https://connector-gateway.lovable.dev/resend/emails`, com
  `LOVABLE_API_KEY` + `RESEND_API_KEY`.
- **Depois:** `POST https://api.resend.com/emails`, autenticando apenas com
  `RESEND_API_KEY` (Bearer). A dependência de `LOVABLE_API_KEY` foi **removida**.

Funciona em qualquer host (Azure inclusive), bastando ter `RESEND_API_KEY`
configurada. Se a chave não estiver presente, o envio é pulado com um aviso no
log (o app não quebra).

### Segurança — `.gitignore` e `.env.example`

- [`.gitignore`](../.gitignore): passou a ignorar `.env` e `.env.*` (antes o
  `.env` poderia ser commitado por engano — risco de vazar a `service_role` key).
- [`.env.example`](../.env.example): modelo documentado de todas as variáveis,
  **sem** valores reais.

---

## 3. Variáveis de ambiente

| Variável | Onde | Tipo | Para que serve |
|---|---|---|---|
| `SUPABASE_URL` | Servidor (runtime) | segredo baixo | URL do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Servidor (runtime) | segredo baixo | Chave anon (valida o token do usuário) |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor (runtime) | **SEGREDO CRÍTICO** | Acesso admin que bypassa RLS |
| `VITE_SUPABASE_URL` | **Build-time** | público | URL embutida no bundle do navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Build-time** | público | Chave anon embutida no bundle |
| `VITE_SUPABASE_PROJECT_ID` | **Build-time** | público | ID do projeto Supabase |
| `RESEND_API_KEY` | Servidor (runtime) | **segredo** | Envio de emails |
| `EMAIL_FROM` | Servidor (runtime) | config | Remetente dos emails |
| `APP_BASE_URL` | Servidor (runtime) | config | URL pública (links de email + destino do cron) |
| `CRON_SECRET` | Servidor (runtime) | **segredo** | Autentica o cron diário de tarefas |
| `BUILD_TARGET` | **Build-time (CI)** | config | `node` apenas no GitHub Actions/Azure |

> ⚠️ **Atenção às `VITE_*`:** são embutidas no JavaScript do navegador **no
> momento do build**. Precisam estar disponíveis no **GitHub Actions** (onde o
> `vite build` roda), não só no runtime da Azure. As demais variáveis são lidas
> em tempo de execução pelo servidor Node.

---

## 4. Como validar o build Node

O ambiente de produção é **Linux** (Azure App Service / GitHub Actions), então a
validação mais fiel é num runner Linux. Opções:

**Validação local (já executada com sucesso, Node v22.22.3):**

```bash
npm install
npm run build:node                          # gera dist/server/index.mjs
node --env-file=.env dist/server/index.mjs  # sobe o servidor (porta 3000)
# ou: npm start  (sem carregar o .env automaticamente)
```

Resultado obtido: `dist/server/index.mjs` gerado, servidor escutando em
`http://localhost:3000`, `/login` e `/` retornando **200**, sem erros no log.

> A porta pode ser controlada via variável `PORT` (a Azure injeta automaticamente).
> `node --env-file` (Node 20.6+) carrega o `.env` no `process.env` — útil para
> testar localmente. Na Azure, as variáveis vêm das *Application settings*.

---

## 5. Próximos passos (Azure) — resumo

Detalhamento completo virá na fase de Azure. Visão geral:

1. **Conectar o Lovable a um repositório GitHub** (integração nativa do Lovable).
2. **Azure App Service (Linux, Node 20)** + Resource Group em `Brazil South`.
3. **Azure Key Vault** para os segredos; referenciados nas *Application settings*
   do App Service via Managed Identity.
4. **GitHub Actions** para build (`npm run build:node`) + deploy do `.output`.
5. **Cron** via GitHub Actions agendado (`POST /api/public/hooks/notify-tarefas`
   às 8h SP = 11h UTC, autenticado com `CRON_SECRET`).
6. Atualizar `APP_BASE_URL` e as **Redirect URLs do Supabase Auth** para o novo
   domínio Azure.

---

## 6. Regras de ouro para quem edita no Lovable

Para o fluxo **Lovable → GitHub → Azure** continuar funcionando:

- ✅ **Pode** criar páginas, componentes, server functions, migrations normalmente.
- ❌ **Não** remover o `cross-env` do `package.json`.
- ❌ **Não** apagar o bloco `BUILD_TARGET` do `vite.config.ts` (é o que gera o
  build da Azure). Em especial, **não** voltar a usar o entry customizado
  `src/server.ts` no build Node — isso reintroduz o erro 500 (`new URL`).
- ❌ **Não** voltar o email para o gateway `connector-gateway.lovable.dev`.
- ❌ **Nunca** commitar o arquivo `.env` (já protegido pelo `.gitignore`).
- ℹ️ Novos segredos/variáveis: adicionar ao `.env.example` e avisar quem cuida da
  Azure para cadastrar no Key Vault e no GitHub Actions.
