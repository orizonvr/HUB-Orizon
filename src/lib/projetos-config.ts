import {
  MA_ESTAGIOS,
  NN_ESTAGIOS,
  type ProjetoTipo,
} from "@/lib/projetos-types";
import { SETORES, SETORES_NN } from "@/lib/ma-utils";

export type ExtraColumn = {
  key: "ebitda_alvo" | "multiplo_ev_ebitda" | "tir_estimada" | "payback_anos";
  label: string;
  format: "currency" | "multiple" | "percent" | "years";
};

export type ProjetoConfig = {
  tipo: ProjetoTipo;
  titulo: string;
  subtituloSuffix: string; // "em pipeline" | "em investimento"
  estagios: ReadonlyArray<{ key: string; label: string }>;
  estagioInicial: string;
  estagioLabels: Record<string, string>;
  queryKey: string;
  csvPrefix: string;
  // Main "value" column header in the table view
  valorColLabel: string;
  // Field-name label for the financial input
  valorInputLabel: string;
  // Extra numeric columns shown in the table view (between valor and Responsável)
  extraColumns: ExtraColumn[];
  // Financial tab variant: which set of fields to render
  finVariant: "ma" | "nn";
  // Show "Tipo de iniciativa" field in NewProjectDialog
  showTipoIniciativa: boolean;
  // Sector options for this tipo
  setores: string[];
  // Label of the first "name" field in the new-project form
  nomeLabel: string;
  // Show comentários tab in the project sheet
  showComentarios: boolean;
  // Show "Tese estratégica" field in the new-project form
  showTeseNoForm: boolean;
};

const labelsFor = (arr: ReadonlyArray<{ key: string; label: string }>) =>
  Object.fromEntries(arr.map((s) => [s.key, s.label]));

export const MA_CONFIG: ProjetoConfig = {
  tipo: "ma",
  titulo: "M&A",
  subtituloSuffix: "em pipeline",
  estagios: MA_ESTAGIOS,
  estagioInicial: "analise_inicial",
  estagioLabels: labelsFor(MA_ESTAGIOS),
  queryKey: "ma-projetos",
  csvPrefix: "ma-projetos",
  valorColLabel: "Valor estimado",
  valorInputLabel: "Valor estimado (R$)",
  extraColumns: [
    { key: "ebitda_alvo", label: "EBITDA Alvo", format: "currency" },
    { key: "multiplo_ev_ebitda", label: "Múltiplo", format: "multiple" },
  ],
  finVariant: "ma",
  showTipoIniciativa: false,
  setores: SETORES,
  nomeLabel: "Codinome",
  showComentarios: true,
  showTeseNoForm: true,
};

export const NN_CONFIG: ProjetoConfig = {
  tipo: "novos_negocios",
  titulo: "Novos Negócios",
  subtituloSuffix: "em investimento",
  estagios: NN_ESTAGIOS,
  estagioInicial: "discussoes_iniciais",
  estagioLabels: labelsFor(NN_ESTAGIOS),
  queryKey: "nn-projetos",
  csvPrefix: "novos-negocios",
  valorColLabel: "Investimento",
  valorInputLabel: "Investimento estimado (R$)",
  extraColumns: [
    { key: "tir_estimada", label: "TIR", format: "percent" },
    { key: "payback_anos", label: "Payback", format: "years" },
  ],
  finVariant: "nn",
  showTipoIniciativa: false,
  setores: SETORES_NN,
  nomeLabel: "Nome",
  showComentarios: false,
  showTeseNoForm: false,
};

export const TIPO_INICIATIVA = [
  "Joint Venture",
  "Parceria estratégica",
  "Novo vertical",
  "M&A pequeno (bolt-on)",
  "Licenciamento",
  "Outro",
] as const;

// Embed "Tipo de iniciativa" inside descricao using a small marker line.
const TIPO_MARKER = /^\[Tipo:\s*([^\]]+)\]\s*\n?/;

export function extractTipoIniciativa(descricao: string | null): {
  tipo: string | null;
  resto: string;
} {
  if (!descricao) return { tipo: null, resto: "" };
  const m = descricao.match(TIPO_MARKER);
  if (!m) return { tipo: null, resto: descricao };
  return { tipo: m[1].trim(), resto: descricao.replace(TIPO_MARKER, "") };
}

export function buildDescricaoComTipo(
  tipoIniciativa: string | null,
  descricao: string | null,
): string | null {
  const t = (tipoIniciativa ?? "").trim();
  const d = (descricao ?? "").trim();
  if (!t && !d) return null;
  if (!t) return d;
  return `[Tipo: ${t}]\n${d}`;
}

export function formatExtra(
  value: number | null | undefined,
  format: ExtraColumn["format"],
): string {
  if (value == null || value === undefined) return "—";
  const n = Number(value);
  if (!isFinite(n)) return "—";
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(n);
    case "multiple":
      return `${n.toFixed(1)}×`;
    case "percent":
      return `${n.toFixed(1).replace(".", ",")}%`;
    case "years":
      return `${n.toFixed(1).replace(".", ",")} anos`;
  }
}
