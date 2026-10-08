// -------------------------------------------------------------------------
// Nitro Configuration — Cabeçalhos de Segurança para Produção (Azure Node)
// -------------------------------------------------------------------------
// O Nitro lê este arquivo durante o build de produção (`npm run build`).
// Aqui aplicamos a política estrita de cabeçalhos HTTP recomendada na auditoria.

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

export default {
  routeRules: {
    "/**": {
      headers: SECURITY_HEADERS,
    },
  },
};
