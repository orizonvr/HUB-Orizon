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
  FileText,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
      <DialogContent className="w-full sm:max-w-4xl md:max-w-5xl h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-xl">
        {q.isLoading || !tarefa ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  const criadoPorNome = useMemo(() => {
    const p = profiles.find((x) => x.id === tarefa.criado_por_id);
    return p?.label ?? "—";
  }, [profiles, tarefa.criado_por_id]);

  // Tab state for mobile responsiveness
  const [mobileTab, setMobileTab] = useState<"detalhes" | "chat">("detalhes");

  return (
    <>
      {/* Top Header */}
      <DialogHeader className="px-5 py-3 border-b bg-card shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-base font-semibold">
              {tarefa.titulo || "Detalhes da Tarefa"}
            </DialogTitle>
            {isAcompanhamento && (
              <Badge variant="secondary" className="gap-1 text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200">
                <Bookmark className="h-3 w-3" /> Acompanhamento
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {STATUS_LABEL[tarefa.status]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {PRIORIDADE_LABEL[tarefa.prioridade]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 pr-6">
            <SaveIndicator state={saveState} />
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden pt-2">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "detalhes" | "chat")}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="detalhes" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1" /> Detalhes & Checklist
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Comentários
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </DialogHeader>

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
                <Label className="text-xs font-medium">Prazo</Label>
                {isAcompanhamento && (
                  <span className="text-[11px] text-muted-foreground">
                    Opcional
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 flex-1 justify-start font-normal text-xs"
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
                          className="h-7 text-xs text-destructive w-full"
                        >
                          Limpar prazo
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                {tarefa.prazo && (
                  <span className="text-xs">
                    <PrazoBadge prazo={tarefa.prazo} concluida={isConcluida} />
                  </span>
                )}
              </div>
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
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium">
        <X className="h-3 w-3" />
        Erro
      </span>
    );
  }
  return null;
}
