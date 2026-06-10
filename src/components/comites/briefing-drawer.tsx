import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  getBriefingContext,
  salvarBriefing,
  gerarBriefingIA,
  type BriefingCampos,
} from "@/lib/comites.functions";
import {
  formatAbsolute,
  formatValorTransacaoMM,
  formatTonDia,
  formatPercentOrizon,
} from "@/lib/format";

type Props = {
  pautaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  readOnly?: boolean;
  comiteId?: string;
};

function fmtNumber(v: number | null | undefined, suffix = ""): string {
  if (v == null || !isFinite(Number(v))) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(v))}${suffix}`;
}

function CamposPanel({ campos }: { campos: BriefingCampos }) {
  const rows: Array<[string, string | null]> = [
    ["Tipo", campos.tipo === "ma" ? "M&A" : "Novos Negócios"],
    ["Estágio", campos.estagio],
    ["Subcategoria", campos.subcategoria],
    ["Contraparte", campos.contraparte],
    ["Setor", campos.setor],
    ["Valor da transação", formatValorTransacaoMM(campos.valor_transacao_mm)],
    ["EBITDA 2025", fmtNumber(campos.ebitda_2025, " MM")],
    ["EBITDA alvo", fmtNumber(campos.ebitda_alvo, " MM")],
    ["Múltiplo EV/EBITDA", fmtNumber(campos.multiplo_ev_ebitda, "x")],
    ["Sinergias estimadas", fmtNumber(campos.sinergias_estimadas, " MM")],
    ["Valor estimado", fmtNumber(campos.valor_estimado, " MM")],
    ["TIR estimada", fmtNumber(campos.tir_estimada, "%")],
    ["Payback", fmtNumber(campos.payback_anos, " anos")],
    ["CAPEX estimado", fmtNumber(campos.capex_estimado, " MM")],
    ["Receita ano 3", fmtNumber(campos.receita_projetada_ano3, " MM")],
    ["TAM", fmtNumber(campos.tam, " MM")],
    ["Volume", formatTonDia(campos.volume_ton_dia)],
    ["% Orizon", formatPercentOrizon(campos.percentual_orizon)],
  ];
  return (
    <div className="space-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-border/40 pb-1">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-right font-medium">{v ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function BriefingDrawer({ pautaId, open, onOpenChange, readOnly = false, comiteId }: Props) {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getBriefingContext);
  const saveFn = useServerFn(salvarBriefing);
  const aiFn = useServerFn(gerarBriefingIA);

  const ctxQ = useQuery({
    queryKey: ["briefing", pautaId],
    queryFn: () => ctxFn({ data: { pauta_id: pautaId! } }),
    enabled: !!pautaId && open,
  });

  const [texto, setTexto] = useState("");
  const [origem, setOrigem] = useState<"manual" | "ia">("manual");

  useEffect(() => {
    if (!open) return;
    const b = ctxQ.data?.briefing;
    if (b) {
      setTexto(b.texto);
      setOrigem(b.origem);
    } else {
      setTexto("");
      setOrigem("manual");
    }
  }, [open, ctxQ.data]);

  const saveM = useMutation({
    mutationFn: () =>
      saveFn({ data: { pauta_id: pautaId!, texto, origem } }),
    onSuccess: () => {
      toast.success("Briefing salvo. Números congelados.");
      qc.invalidateQueries({ queryKey: ["briefing", pautaId] });
      if (comiteId) qc.invalidateQueries({ queryKey: ["comite", comiteId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiM = useMutation({
    mutationFn: () => aiFn({ data: { pauta_id: pautaId! } }),
    onSuccess: (res) => {
      if (!res.configured) {
        toast.info(
          "Geração com IA ainda não disponível — aguardando liberação da chave da Anthropic pelo TI.",
        );
        return;
      }
      setTexto(res.texto);
      setOrigem("ia");
      toast.success("Rascunho gerado. Revise antes de salvar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const briefing = ctxQ.data?.briefing ?? null;
  const camposExibidos = briefing?.campos ?? ctxQ.data?.campos_atuais ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            Briefing {ctxQ.data ? `— ${ctxQ.data.projeto_nome}` : ""}
          </SheetTitle>
          <SheetDescription>
            {readOnly
              ? "Visualização — comitê fora de preparação."
              : "Memo de uma página. Ao salvar, os números do projeto são congelados neste briefing."}
          </SheetDescription>
        </SheetHeader>

        {ctxQ.isLoading || !camposExibidos ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              {briefing && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {briefing.origem === "ia" ? "IA" : "Manual"}
                  </Badge>
                  <span>Gerado em {formatAbsolute(briefing.gerado_em)}</span>
                </div>
              )}
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => aiM.mutate()}
                    disabled={aiM.isPending}
                  >
                    {aiM.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Gerar com IA
                  </Button>
                </div>
              )}
              <Textarea
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  if (origem === "ia") setOrigem("manual");
                }}
                disabled={readOnly}
                placeholder="Escreva o briefing em markdown (Resumo, Tese, Números-chave, Riscos, Próximos passos, Recomendação)..."
                className="min-h-[320px] font-mono text-xs"
              />
              {briefing && !readOnly && (
                <p className="text-[11px] text-muted-foreground">
                  Salvar novamente recongela os números para os valores atuais.
                </p>
              )}
              {!readOnly && (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => saveM.mutate()}
                    disabled={saveM.isPending || !texto.trim()}
                  >
                    {saveM.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar briefing
                  </Button>
                </div>
              )}
            </div>

            <aside className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold">Números do projeto</p>
                <p className="text-[11px] text-muted-foreground">
                  {briefing
                    ? "Congelados no momento do save."
                    : "Estes números serão congelados ao salvar."}
                </p>
              </div>
              <CamposPanel campos={camposExibidos} />
            </aside>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
