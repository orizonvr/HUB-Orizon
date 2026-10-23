import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Gavel,
  Calendar,
  Users,
  Loader2,
  Sparkles,
  Info,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { listProfiles } from "@/lib/projetos.functions";
import { createComite } from "@/lib/comites.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function defaultDateTime(): string {
  // Próxima terça-feira às 14:00 (horário padrão de comitê)
  const d = new Date();
  const day = d.getDay(); // 0=Dom, 2=Ter
  const diff = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(14, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NovoComiteDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profilesFn = useServerFn(listProfiles);
  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: () => profilesFn(),
    enabled: open,
  });
  const profileOptions = useMemo(
    () =>
      (profilesQ.data?.profiles ?? []).map((p) => ({
        id: p.id,
        label: p.nome_completo,
      })),
    [profilesQ.data],
  );

  const [titulo, setTitulo] = useState("");
  const [dataStr, setDataStr] = useState(defaultDateTime());
  const [participantes, setParticipantes] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitulo("");
      setDataStr(defaultDateTime());
      setParticipantes([]);
    }
  }, [open]);

  const createFn = useServerFn(createComite);
  const m = useMutation({
    mutationFn: (input: { titulo: string; data: string; participante_ids: string[] }) =>
      createFn({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["comites"] });
      onOpenChange(false);
      toast.success("Comitê criado com sucesso.");
      navigate({ to: "/comites/$id", params: { id: res.comite.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (titulo.trim().length < 3) {
      toast.error("O título do comitê precisa de no mínimo 3 caracteres.");
      return;
    }
    if (!dataStr) {
      toast.error("Informe a data e o horário do comitê.");
      return;
    }
    const when = new Date(dataStr);
    const limit = new Date();
    limit.setDate(limit.getDate() - 1);
    if (when < limit) {
      toast.error("A data não pode ser anterior a ontem.");
      return;
    }
    if (participantes.length === 0) {
      toast.error("Selecione ao menos um membro participante com alçada de voto.");
      return;
    }
    m.mutate({
      titulo: titulo.trim(),
      data: when.toISOString(),
      participante_ids: participantes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* ======================================================== */}
        {/* HERO BANNER EXECUTIVO INSTITUCIONAL DO MODAL             */}
        {/* ======================================================== */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
          {/* Marca d'água oficial circular da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex items-start gap-3.5 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Gavel className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  Novo Comitê Executivo
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Governança Formal</span>
                </span>
              </div>
              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate max-w-md">
                Abra uma sessão oficial para deliberar teses de M&amp;A e Novos Negócios.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CORPO DO FORMULÁRIO COM BENTO CONTAINERS                 */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Container Bento 1: Informações Gerais */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary/80" />
              Sessão & Agendamento
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="titulo" className="text-xs font-semibold text-foreground">
                Título da Sessão <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Comitê Estratégico de M&A — Rodada Maio"
                className="h-9 rounded-xl bg-background border-border/80 text-xs focus-visible:ring-primary/25 placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data" className="text-xs font-semibold text-foreground">
                Data e Horário da Reunião <span className="text-destructive">*</span>
              </Label>
              <Input
                id="data"
                type="datetime-local"
                value={dataStr}
                onChange={(e) => setDataStr(e.target.value)}
                className="h-9 rounded-xl bg-background border-border/80 text-xs focus-visible:ring-primary/25"
              />
            </div>
          </div>

          {/* Container Bento 2: Membros Convocados */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary/80" />
              Participantes Convocados ({participantes.length})
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Membros com Alçada de Voto <span className="text-destructive">*</span>
              </Label>
              <MultiProfileSelect
                options={profileOptions}
                value={participantes}
                onChange={setParticipantes}
                placeholder={
                  profilesQ.isLoading ? "Carregando equipe..." : "Selecione membros executivos..."
                }
                triggerClassName="rounded-xl bg-background border-border/80 text-xs h-9.5"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <Info className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                <span>Os participantes convocados terão acesso à pauta e ao registro das deliberações.</span>
              </p>
            </div>
          </div>

          {/* Card de Apoio e Orientações */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Você poderá adicionar projetos, anexar teses e gerar briefings executivos com Inteligência Artificial imediatamente na próxima tela de pauta.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RODAPÉ EXECUTIVO DO MODAL                                */}
        {/* ======================================================== */}
        <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-medium rounded-xl h-9 px-4 cursor-pointer"
            disabled={m.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={m.isPending}
            className="text-xs font-bold rounded-xl h-9 px-4 gap-1.5 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            {m.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Criando Comitê...</span>
              </>
            ) : (
              <>
                <span>Avançar para Pauta</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

