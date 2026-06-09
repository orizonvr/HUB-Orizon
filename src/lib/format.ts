// Shared formatting helpers used across the polish layer.

const AVATAR_PALETTE = [
  "oklch(0.78 0.075 85)",   // gold
  "oklch(0.62 0.13 155)",   // success green
  "oklch(0.55 0.18 27)",    // destructive red
  "oklch(0.7 0.1 250)",     // blue
  "oklch(0.7 0.12 320)",    // pink
  "oklch(0.65 0.12 200)",   // teal
  "oklch(0.72 0.13 60)",    // amber
  "oklch(0.6 0.15 280)",    // purple
  "oklch(0.7 0.1 130)",     // lime
  "oklch(0.6 0.13 20)",     // brick
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorFromName(name: string | null | undefined): string {
  const v = (name ?? "").trim() || "?";
  return AVATAR_PALETTE[hashString(v) % AVATAR_PALETTE.length];
}

export function avatarBgStyle(name: string | null | undefined): React.CSSProperties {
  return {
    backgroundColor: colorFromName(name),
    color: "white",
  };
}

export function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTonDia(v: number | null | undefined): string | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n)} ton/dia`;
}

export function formatPercentOrizon(v: number | null | undefined): string | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  const isInt = Math.abs(n - Math.round(n)) < 0.05;
  return `${isInt ? Math.round(n) : n.toFixed(1).replace(".", ",")}%`;
}

export function formatValorTransacaoMM(v: number | null | undefined): string | null {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")} bi`;
  return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n)} MM`;
}

