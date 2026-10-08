// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// -------------------------------------------------------------------------
// Alvo de build (Cloudflare/Lovable vs. Node/Azure)
// -------------------------------------------------------------------------
// Por padrão (Lovable e dev local) o build mantém o comportamento da Lovable:
// o @lovable.dev/vite-tanstack-config roda o Nitro com preset `cloudflare-module`
// dentro do contexto Lovable — assim a edição/preview/deploy na plataforma
// Lovable seguem funcionando sem mudança.
//
// Quando BUILD_TARGET=node (definido no pipeline GitHub Actions → Azure App
// Service), pedimos ao MESMO Nitro embutido no plugin Lovable o preset
// `node-server`, que gera um servidor Node autônomo (rodável com Node 22).
//
// Importante: NÃO usamos o entry customizado src/server.ts no build Node. Aquele
// wrapper foi escrito no formato de Cloudflare Worker (`export default { fetch }`)
// e é incompatível com o adaptador node-server do Nitro/srvx (a request chega
// como IncomingMessage cru, com URL relativa, quebrando em `new URL("/")`).
// No build Node deixamos o TanStack Start usar o entry padrão dele, que já
// integra corretamente com o Nitro. O wrapper de erro segue ativo no build
// Cloudflare/Lovable.
const isNodeBuild = process.env.BUILD_TARGET === "node";

// Cabeçalhos HTTP de segurança para produção (Azure App Service / Nitro) e desenvolvimento
const SECURITY_HEADERS = {
  // HSTS (HTTP Strict Transport Security): impõe HTTPS estrito por 1 ano incluindo subdomínios (ID 02)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  // Anti-Clickjacking: impede encapsulamento do site/login em iframes maliciosos (ID 03)
  "X-Frame-Options": "DENY",
  // Protege contra ataques de MIME-type sniffing
  "X-Content-Type-Options": "nosniff",
  // Política estrita de referrer para preservar sigilo de parâmetros de URL corporativos
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Desabilita recursos desnecessários do navegador para a aplicação
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // Content Security Policy (CSP): controle de origens autorizadas para scripts, estilos e conexões (ID 03)
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://*.supabase.co https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev https://*.lovable.app",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

export default defineConfig({
  vite: {
    server: {
      headers: SECURITY_HEADERS,
    },
    preview: {
      headers: SECURITY_HEADERS,
    },
  },
  tanstackStart: isNodeBuild
    ? {}
    : {
        // Redireciona a entrada SSR para src/server.ts (wrapper de erros) — Cloudflare/Lovable.
        server: { entry: "server" },
      },
  ...(isNodeBuild
    ? {
        // Build para Azure (Node): Nitro com preset node-server.
        nitro: {
          preset: "node-server",
          output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
        },
      }
    : {}),
});
