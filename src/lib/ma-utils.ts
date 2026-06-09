import {
  MA_ESTAGIOS,
  NN_ESTAGIOS,
  type Projeto,
} from "@/lib/projetos-types";

// Combined label map across both project types (keys are unique per type).
export const MA_ESTAGIO_LABEL: Record<string, string> = Object.fromEntries([
  ...MA_ESTAGIOS.map((s) => [s.key, s.label] as const),
  ...NN_ESTAGIOS.map((s) => [s.key, s.label] as const),
]);

export function formatBRL(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (!isFinite(v) || v === 0) return "R$ 0";
  if (Math.abs(v) >= 1_000_000_000) {
    return `R$ ${(v / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  }
  if (Math.abs(v) >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toFixed(0)} mi`;
  }
  if (Math.abs(v) >= 1_000) {
    return `R$ ${(v / 1_000).toFixed(0)} mil`;
  }
  return `R$ ${v.toFixed(0)}`;
}

export function formatBRLFull(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

const MONTHS_PT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m] = iso.split("-");
  const monthIdx = Number(m) - 1;
  if (isNaN(monthIdx) || !MONTHS_PT[monthIdx]) return iso;
  return `${MONTHS_PT[monthIdx]}/${y.slice(2)}`;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))} mês`;
  return `${Math.floor(diff / (86400 * 365))} a`;
}

export type Health = "verde" | "amarelo" | "vermelho";

export function healthFor(p: Projeto): Health {
  const today = new Date().toISOString().slice(0, 10);
  const lastUpd = new Date(p.atualizado_em).getTime();
  const daysSince = (Date.now() - lastUpd) / (1000 * 60 * 60 * 24);
  const due = p.data_fechamento_prevista;
  const overdue = due ? due < today : false;
  const dueSoon = due
    ? (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 14
    : false;

  if (daysSince > 14 || overdue) return "vermelho";
  if (daysSince > 7 || dueSoon) return "amarelo";
  return "verde";
}

export const HEALTH_BG: Record<Health, string> = {
  verde: "bg-success",
  amarelo: "bg-warning",
  vermelho: "bg-destructive",
};

export const HEALTH_LABEL: Record<Health, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Crítico",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const SETORES = [
  "Saneamento",
  "Energia",
  "Resíduos Sólidos",
  "Infraestrutura",
  "Logística",
  "Concessões",
  "Tecnologia",
  "Outros",
];

export const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
  perdido: "Perdido",
};

export const TIPO_DOCUMENTO = ["NDA", "IIM", "DD Financeira", "SPA", "Outro"];
