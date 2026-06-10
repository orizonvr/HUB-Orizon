import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatBRLFull,
  healthFor,
  HEALTH_BG,
  HEALTH_LABEL,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  formatAbsolute,
  formatPercentOrizon,
  formatTonDia,
  formatValorTransacaoMM,
} from "@/lib/format";
import { formatExtra, type ProjetoConfig } from "@/lib/projetos-config";
import { SUBCATEGORIA_LABEL, type Profile, type Projeto } from "@/lib/projetos-types";

type ProfileLike = Pick<Profile, "nome_completo"> & Partial<Profile>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetos: Projeto[];
  profilesById: Map<string, ProfileLike>;
  config: ProjetoConfig;
};

const DASH = "—";

function display(v: string | number | null | undefined): string {
  if (v == null) return DASH;
  const s = String(v).trim();
  return s === "" ? DASH : s;
}

type Row = {
  label: string;
  render: (p: Projeto) => React.ReactNode;
  multiline?: boolean;
};

export function CompararTargets({
  open,
  onOpenChange,
  projetos,
  profilesById,
  config,
}: Props) {
  const isNN = config.tipo === "novos_negocios";

  const identidade: Row[] = [
    { label: "Contraparte", render: (p) => display(p.contraparte) },
    { label: "Setor", render: (p) => display(p.setor) },
    ...(isNN
      ? [
          {
            label: "Subcategoria",
            render: (p: Projeto) =>
              p.subcategoria
                ? SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria
                : DASH,
          },
        ]
      : []),
    {
      label: "Status",
      render: (p) => STATUS_LABEL[p.status] ?? display(p.status),
    },
    {
      label: "Saúde",
      render: (p) => {
        const h = healthFor(p);
        return (
          <span className="inline-flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", HEALTH_BG[h])} />
            {HEALTH_LABEL[h]}
          </span>
        );
      },
    },
    {
      label: "Responsável",
      render: (p) =>
        (p.responsavel_id && profilesById.get(p.responsavel_id)?.nome_completo) ||
        DASH,
    },
    {
      label: "% Orizon",
      render: (p) => formatPercentOrizon(p.percentual_orizon) ?? DASH,
    },
  ];

  const financeiroMa: Row[] = [
    {
      label: "Valor da transação",
      render: (p) => formatValorTransacaoMM(p.valor_transacao_mm) ?? DASH,
    },
    { label: "Valor estimado", render: (p) => formatBRLFull(p.valor_estimado) },
    { label: "EBITDA 2025", render: (p) => formatBRLFull(p.ebitda_2025) },
    { label: "EBITDA alvo", render: (p) => formatBRLFull(p.ebitda_alvo) },
    {
      label: "Múltiplo EV/EBITDA",
      render: (p) => formatExtra(p.multiplo_ev_ebitda, "multiple"),
    },
    {
      label: "Sinergias estimadas",
      render: (p) => formatBRLFull(p.sinergias_estimadas),
    },
    { label: "Volume", render: (p) => formatTonDia(p.volume_ton_dia) ?? DASH },
  ];

  const financeiroNn: Row[] = [
    {
      label: "Investimento estimado",
      render: (p) => formatBRLFull(p.valor_estimado),
    },
    { label: "Capex estimado", render: (p) => formatBRLFull(p.capex_estimado) },
    {
      label: "TIR estimada",
      render: (p) => formatExtra(p.tir_estimada, "percent"),
    },
    { label: "Payback", render: (p) => formatExtra(p.payback_anos, "years") },
    {
      label: "Receita projetada ano 3",
      render: (p) => formatBRLFull(p.receita_projetada_ano3),
    },
    { label: "TAM", render: (p) => formatBRLFull(p.tam) },
    { label: "Volume", render: (p) => formatTonDia(p.volume_ton_dia) ?? DASH },
  ];

  const financeiro = config.finVariant === "ma" ? financeiroMa : financeiroNn;

  const prazos: Row[] = [
    { label: "Início", render: (p) => formatAbsolute(p.data_inicio) },
    {
      label: "Fechamento previsto",
      render: (p) => formatAbsolute(p.data_fechamento_prevista),
    },
  ];

  const narrativa: Row[] = [
    { label: "Tese", render: (p) => display(p.tese), multiline: true },
    { label: "Riscos", render: (p) => display(p.riscos), multiline: true },
    {
      label: "Próximos passos",
      render: (p) => display(p.proximos_passos),
      multiline: true,
    },
  ];

  const sections: Array<{ title: string; rows: Row[] }> = [
    { title: "Identidade", rows: identidade },
    { title: "Financeiro", rows: financeiro },
    { title: "Prazos", rows: prazos },
    { title: "Narrativa", rows: narrativa },
  ];

  const totalCols = projetos.length + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(95vw,1100px)] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Comparar targets</DialogTitle>
          <DialogDescription>
            {projetos.length} projetos lado a lado
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-background w-44 px-4 py-3 text-left text-xs font-medium text-muted-foreground" />
                {projetos.map((p) => (
                  <th
                    key={p.id}
                    className="px-4 py-3 text-left align-top min-w-[220px]"
                  >
                    <div className="font-medium leading-tight">{p.nome}</div>
                    <Badge variant="secondary" className="mt-1.5">
                      {config.estagioLabels[p.estagio] ?? p.estagio}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <>
                  <tr key={`${section.title}-header`} className="bg-muted/40">
                    <td
                      colSpan={totalCols}
                      className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr
                      key={`${section.title}-${row.label}`}
                      className="border-b border-border/50"
                    >
                      <td className="sticky left-0 z-10 bg-background w-44 px-4 py-2.5 align-top text-xs font-medium text-muted-foreground">
                        {row.label}
                      </td>
                      {projetos.map((p) => (
                        <td
                          key={p.id}
                          className={cn(
                            "px-4 py-2.5 align-top",
                            row.multiline
                              ? "whitespace-pre-wrap text-xs"
                              : "text-sm",
                          )}
                        >
                          {row.render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
