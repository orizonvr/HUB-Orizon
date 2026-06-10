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

export default defineConfig({
  tanstackStart: isNodeBuild
    ? {}
    : {
        // Redireciona a entrada SSR para src/server.ts (wrapper de erros) — Cloudflare/Lovable.
        server: { entry: "server" },
      },
  ...(isNodeBuild
    ? {
        // Build para Azure (Node): Nitro com preset node-server.
        // Output FIXADO em dist/ — sem isso, a versão do plugin Lovable muda o
        // diretório padrão (v1.8 = dist/server, v2.3 = .output/server), quebrando
        // o `npm start` (que roda `node dist/server/index.mjs`) e o deploy.
        nitro: {
          preset: "node-server",
          output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
        },
      }
    : {}),
});
