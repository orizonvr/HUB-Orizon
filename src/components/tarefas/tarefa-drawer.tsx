import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  ExternalLink,
  Loader2,
  Check,
  X,
  Bookmark,
  Users,
  AlertCircle,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { cn } from "@/lib/utils";
import {
  getTarefaById,
  updateTarefa,
} from "@/lib/tarefas.functions";
import { listProfiles } from "@/lib/projetos.functions";
import {
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  TIPO_LABEL,
  type TarefaComContexto,
  type TarefaPrioridade,
  type TarefaStatus,
  type TarefaTipo,
} from "@/lib/tarefas-types";
import { isResponsavelElegivel } from "@/lib/projetos-config";
import { PrazoBadge } from "./tarefas-tab";
import { TarefaChat } from "./tarefa-chat";
import { TarefaSubtarefas } from "./tarefa-subtarefas";

type Props = {
  tarefaId: string | null;
  onOpenChange: (open: boolean) => void;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

export function TarefaDrawer({ tarefaId, onOpenChange }: Props) {
  const open = tarefaId !== null;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getTarefaById);
  const updateFn = useServerFn(updateTarefa);
  const profilesFn = useServerFn(listProfiles);

  const q = useQuery({
    queryKey: ["tarefa", tarefaId],
    queryFn: () => getFn({ data: { id: tarefaId! } }),
    enabled: open,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: () => profilesFn(),
    staleTime: 60_000,
  });

  const tarefa = q.data?.tarefa as TarefaComContexto | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl md:max-w-5xl h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">
          {tarefa?.titulo ?? "Detalhes da Tarefa"}
        </DialogTitle>
        {q.isError ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-2xs">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Não foi possível carregar a tarefa
            </p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              {(q.error as Error)?.message || "A tarefa pode ter sido excluída ou você não possui permissão para visualizá-la."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl mt-2 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        ) : q.isLoading || !tarefa ? (
          <div className="flex flex-col items-center justify-center flex-1 space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando detalhes da tarefa...</p>
          </div>
        ) : (
          <DialogBody
            tarefa={tarefa}
            profiles={(profilesQ.data?.profiles ?? [])
              .filter(
                (p) =>
                  (tarefa.responsavel_ids ?? []).includes(p.id) ||
                  tarefa.dependencia_id === p.id ||
                  isResponsavelElegivel(p),
              )
              .map((p) => ({
                id: p.id,
                label: p.nome_completo,
              }))}
            onUpdate={async (patch) => {
              await updateFn({ data: { id: tarefa.id, patch } });
              qc.invalidateQueries({ queryKey: ["tarefa", tarefa.id] });
              qc.invalidateQueries({ queryKey: ["tarefas"] });
              qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
              qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
              qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
              qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
            }}
            onNavigateToProjeto={() => {
              onOpenChange(false);
              const dest =
                tarefa.projeto_tipo === "ma" ? "/ma" : "/novos-negocios";
              navigate({ to: dest });
              setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent("orizon:open-projeto", {
                    detail: { id: tarefa.projeto_id, tab: "tarefas" },
                  }),
                );
              }, 150);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  tarefa,
  profiles,
  onUpdate,
  onNavigateToProjeto,
}: {
  tarefa: TarefaComContexto;
  profiles: Array<{ id: string; label: string }>;
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onNavigateToProjeto: () => void;
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const isEditingTituloRef = useRef(false);
  const serverSnapshot = useRef({ titulo: tarefa.titulo });

  useEffect(() => {
    if (!isEditingTituloRef.current && tarefa.titulo !== serverSnapshot.current.titulo) {
      setTitulo(tarefa.titulo);
      serverSnapshot.current.titulo = tarefa.titulo;
    }
  }, [tarefa.titulo]);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = () => {
    setSaveState("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1500);
  };

  const save = async (patch: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      await onUpdate(patch);
      flashSaved();
    } catch (e) {
      setSaveState("error");
      toast.error((e as Error).message || "Falha ao salvar");
    }
  };

  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const debouncedSave = (key: string, patch: Record<string, unknown>) => {
    if (debouncers.current[key]) clearTimeout(debouncers.current[key]!);
    debouncers.current[key] = setTimeout(() => {
      void save(patch);
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      for (const t of Object.values(debouncers.current)) if (t) clearTimeout(t);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const onTituloChange = (v: string) => {
    setTitulo(v);
    debouncedSave("titulo", { titulo: v });
  };

  const onTituloBlur = () => {
    isEditingTituloRef.current = false;
    if (debouncers.current.titulo) {
      clearTimeout(debouncers.current.titulo);
      debouncers.current.titulo = null;
    }
    const clean = titulo.trim();
    if (clean.length > 0 && clean !== serverSnapshot.current.titulo) {
      serverSnapshot.current.titulo = clean;
      setTitulo(clean);
      void save({ titulo: clean });
    } else if (clean.length === 0) {
      setTitulo(serverSnapshot.current.titulo);
    }
  };

  const onStatusChange = (v: TarefaStatus) => void save({ status: v });
  const onPrioChange = (v: TarefaPrioridade) => void save({ prioridade: v });
  const onTipoChange = (v: TarefaTipo) => void save({ tipo: v });
  const onResponsaveisChange = (ids: string[]) =>
    void save({ responsavel_ids: ids });

  const onDependenciaChange = (value: string) => {
    if (value === "nenhuma") {
      void save({ dependencia_id: null, dependencia_terceiro: false });
    } else if (value === "terceiros") {
      void save({ dependencia_id: null, dependencia_terceiro: true });
    } else {
      void save({ dependencia_id: value, dependencia_terceiro: false });
    }
  };

  const currentDependenciaValue = useMemo(() => {
    if (tarefa.dependencia_terceiro) return "terceiros";
    if (tarefa.dependencia_id) return tarefa.dependencia_id;
    return "nenhuma";
  }, [tarefa.dependencia_terceiro, tarefa.dependencia_id]);

  const onPrazoChange = (date: Date | undefined) => {
    if (!date) {
      void save({ prazo: null });
      return;
    }
    const iso = format(date, "yyyy-MM-dd");
    void save({ prazo: iso });
  };

  const isConcluida = tarefa.status === "concluida";
  const isAcompanhamento = tarefa.tipo === "acompanhamento";

  // Diagnóstico e métricas de prazo / atraso da tarefa
  const prazoInfo = useMemo(() => {
    if (!tarefa.prazo) {
      return {
        isAtrasada: false,
        isHoje: false,
        diffDias: 0,
        dataFormatada: "Sem prazo",
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pDate = new Date(tarefa.prazo + "T00:00:00");
    const diff = Math.round((pDate.getTime() - today.getTime()) / 86_400_000);
    const dataFormatada = format(pDate, "dd/MM/yyyy");
    const isAtrasada = !isConcluida && tarefa.status !== "cancelada" && diff < 0;
    const isHoje = !isConcluida && tarefa.status !== "cancelada" && diff === 0;

    return {
      isAtrasada,
      isHoje,
      diffDias: Math.abs(diff),
      dataFormatada,
    };
  }, [tarefa.prazo, isConcluida, tarefa.status]);

  const handleReagendar = (diasAdicionais: number) => {
    const target = new Date();
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + diasAdicionais);
    const iso = format(target, "yyyy-MM-dd");
    void save({ prazo: iso });
    toast.success(`Prazo atualizado para ${format(target, "dd/MM/yyyy")}`);
  };

  const criadoPorNome = useMemo(() => {
    const p = profiles.find((x) => x.id === tarefa.criado_por_id);
    return p?.label ?? "—";
  }, [profiles, tarefa.criado_por_id]);

  // Tab state for mobile responsiveness
  const [mobileTab, setMobileTab] = useState<"detalhes" | "chat">("detalhes");

  return (
    <>
      {/* Top Hero Banner Header (Padrão Banner Executivo Dashboard) */}
      <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4 border-b border-primary/20 shrink-0">
        {/* Marca d'água circular oficial da Orizon */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-44 w-44 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3 pr-12">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <ListTodo className="h-5 w-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight truncate max-w-lg">
                  {tarefa.titulo || "Detalhes da Tarefa"}
                </DialogTitle>

                {/* Badge Alerta de Atraso no Banner */}
                {prazoInfo.isAtrasada && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/50 text-[10px] font-bold text-rose-100 shadow-xs animate-pulse">
                    <AlertTriangle className="h-3 w-3 text-rose-200" />
                    <span>Atrasada há {prazoInfo.diffDias} dia{prazoInfo.diffDias === 1 ? "" : "s"}</span>
                  </span>
                )}

                {prazoInfo.isHoje && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/50 text-[10px] font-bold text-amber-100 shadow-xs">
                    <Clock className="h-3 w-3 text-amber-200" />
                    <span>Vence Hoje</span>
                  </span>
                )}

                {isAcompanhamento && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-semibold tracking-wide text-blue-200 uppercase">
                    <Bookmark className="h-3 w-3 text-blue-300" /> Acompanhamento
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-medium tracking-wide text-white/90">
                  {STATUS_LABEL[tarefa.status]}
                </span>

                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-medium tracking-wide text-white/90">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      tarefa.prioridade === "alta"
                        ? "bg-rose-400"
                        : tarefa.prioridade === "media"
                          ? "bg-amber-300"
                          : "bg-emerald-300",
                    )}
                  />
                  {PRIORIDADE_LABEL[tarefa.prioridade]}
                </span>
              </div>

              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate">
                {tarefa.projeto_nome} • {tarefa.projeto_tipo === "ma" ? "M&A Pipeline" : "Novos Negócios"}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SaveIndicator state={saveState} />
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden pt-3 relative z-10">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "detalhes" | "chat")}>
            <TabsList className="grid w-full grid-cols-2 h-8 bg-black/25 p-0.5 border border-white/15 rounded-lg text-white/80">
              <TabsTrigger
                value="detalhes"
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold"
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> Detalhes & Checklist
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Comentários
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Split Panel Content */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Column: Form & Checklist */}
        <div
          className={cn(
            "md:col-span-7 flex flex-col h-full overflow-y-auto p-5 space-y-4 border-r bg-background",
            mobileTab === "chat" && "hidden md:flex",
          )}
        >
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="td-titulo" className="text-xs font-medium">
              Título da Tarefa
            </Label>
            <Input
              id="td-titulo"
              value={titulo}
              onFocus={() => {
                isEditingTituloRef.current = true;
              }}
              onChange={(e) => onTituloChange(e.target.value)}
              onBlur={onTituloBlur}
              className={cn(
                "text-base font-semibold h-10",
                isConcluida && "line-through text-muted-foreground",
              )}
            />
          </div>

          {/* BANNER EXECUTIVO DE ALERTA DE ATRASO (SLA CRÍTICO) */}
          {prazoInfo.isAtrasada && (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 dark:bg-destructive/15 p-3.5 space-y-3 shadow-2xs border-l-4 border-l-destructive">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/20 text-destructive border border-destructive/30 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs font-bold text-destructive">
                        Prazo Expirado há {prazoInfo.diffDias} dia{prazoInfo.diffDias === 1 ? "" : "s"}
                      </h5>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/25">
                        Venceu em {prazoInfo.dataFormatada}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Esta tarefa está impactando o SLA do projeto. Reagende uma nova data ou marque como concluída para regularizar.
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas de Reagendamento / Conclusão */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:justify-end pl-11 sm:pl-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(0)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-destructive/30 hover:bg-destructive/10 text-foreground cursor-pointer"
                  >
                    Mover p/ Hoje
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(2)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-destructive/30 hover:bg-destructive/10 text-foreground cursor-pointer"
                  >
                    +2 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(7)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-destructive/30 hover:bg-destructive/10 text-foreground cursor-pointer"
                  >
                    +1 semana
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onStatusChange("concluida")}
                    className="h-7 px-2.5 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 shadow-2xs"
                  >
                    <Check className="h-3 w-3" />
                    <span>Concluir</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BANNER DE VENCIMENTO HOJE */}
          {prazoInfo.isHoje && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 dark:bg-amber-500/15 p-3.5 space-y-3 shadow-2xs border-l-4 border-l-amber-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Vencimento Previsto para Hoje
                      </h5>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        {prazoInfo.dataFormatada}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Esta tarefa deve ser finalizada hoje para manter o cronograma e não entrar em atraso no SLA.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:justify-end pl-11 sm:pl-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(1)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-amber-500/30 hover:bg-amber-500/10 text-foreground cursor-pointer"
                  >
                    +1 dia
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(3)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-amber-500/30 hover:bg-amber-500/10 text-foreground cursor-pointer"
                  >
                    +3 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReagendar(7)}
                    className="h-7 px-2 text-[10px] font-medium rounded-lg border-amber-500/30 hover:bg-amber-500/10 text-foreground cursor-pointer"
                  >
                    +1 semana
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onStatusChange("concluida")}
                    className="h-7 px-2.5 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1 shadow-2xs"
                  >
                    <Check className="h-3 w-3" />
                    <span>Concluir</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tipo (Padrão vs Acompanhamento) + Status + Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select
                value={tarefa.tipo ?? "tarefa"}
                onValueChange={(v) => onTipoChange(v as TarefaTipo)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select
                value={tarefa.status}
                onValueChange={(v) => onStatusChange(v as TarefaStatus)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prioridade</Label>
              <Select
                value={tarefa.prioridade}
                onValueChange={(v) => onPrioChange(v as TarefaPrioridade)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsáveis e Dependência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Responsáveis</Label>
              <MultiProfileSelect
                options={profiles}
                value={tarefa.responsavel_ids}
                onChange={onResponsaveisChange}
                placeholder="Selecione os responsáveis"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center justify-between">
                <span>Dependência</span>
                {tarefa.dependencia_terceiro && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                    Terceiros
                  </Badge>
                )}
              </Label>
              <Select
                value={currentDependenciaValue}
                onValueChange={onDependenciaChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione dependência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma dependência</SelectItem>
                  <SelectItem value="terceiros">
                    <span className="font-medium text-amber-600">Terceiros (Consultores / Regulatório / Outros)</span>
                  </SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Usuário: {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prazo e Projeto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Prazo de Entrega</Label>
                {isAcompanhamento && (
                  <span className="text-[11px] text-muted-foreground">
                    Opcional
                  </span>
                )}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-9 justify-start font-normal text-xs rounded-lg transition-colors",
                      prazoInfo.isAtrasada &&
                        "border-destructive/60 bg-destructive/5 text-destructive font-semibold hover:bg-destructive/10",
                      prazoInfo.isHoje &&
                        "border-amber-500/60 bg-amber-500/5 text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-500/10",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {tarefa.prazo
                      ? format(
                          new Date(tarefa.prazo + "T00:00:00"),
                          "dd/MM/yyyy",
                        )
                      : "Sem prazo definido"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 border-b bg-muted/20 flex items-center gap-1 flex-wrap max-w-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReagendar(0)}
                      className="h-6 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                      Hoje
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReagendar(1)}
                      className="h-6 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                      Amanhã
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReagendar(2)}
                      className="h-6 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                      +2 dias
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReagendar(7)}
                      className="h-6 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                      +1 semana
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReagendar(15)}
                      className="h-6 px-1.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary cursor-pointer"
                    >
                      +15 dias
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={
                      tarefa.prazo
                        ? new Date(tarefa.prazo + "T00:00:00")
                        : undefined
                    }
                    onSelect={onPrazoChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {tarefa.prazo && (
                    <div className="p-2 border-t text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPrazoChange(undefined)}
                        className="h-7 text-xs text-destructive w-full cursor-pointer"
                      >
                        Limpar prazo
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Projeto Vinculado</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/30">
                <span className="text-xs truncate flex-1 font-medium">
                  {tarefa.projeto_nome}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {tarefa.projeto_tipo === "ma" ? "M&A" : "NN"}
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onNavigateToProjeto}
                  className="h-6 w-6 text-primary"
                  title="Abrir página do projeto"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Subtarefas (Checklist) */}
          <div className="pt-2">
            <TarefaSubtarefas tarefaId={tarefa.id} />
          </div>

          {/* Rodapé informativo */}
          <div className="pt-3 border-t text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              Criado por <span className="font-medium text-foreground">{criadoPorNome}</span> em{" "}
              {format(new Date(tarefa.created_at), "dd/MM/yyyy")}
            </span>
            <button
              type="button"
              onClick={onNavigateToProjeto}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver no Projeto
            </button>
          </div>
        </div>

        {/* Right Column: WhatsApp-Style Comments Chat */}
        <div
          className={cn(
            "md:col-span-5 flex flex-col h-full overflow-hidden p-3 md:p-4 bg-muted/10",
            mobileTab === "detalhes" && "hidden md:flex",
          )}
        >
          <TarefaChat tarefaId={tarefa.id} />
        </div>
      </div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/90 shadow-2xs">
        <Loader2 className="h-3 w-3 animate-spin text-white" />
        Salvando…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] text-emerald-200 font-medium shadow-2xs">
        <Check className="h-3 w-3 text-emerald-300" />
        Salvo
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-[10px] text-rose-200 font-medium shadow-2xs">
        <X className="h-3 w-3 text-rose-300" />
        Erro ao salvar
      </span>
    );
  }
  return null;
}
