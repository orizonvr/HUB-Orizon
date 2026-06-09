import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, ExternalLink, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ORIGEM_LABEL,
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  type TarefaComContexto,
  type TarefaOrigem,
  type TarefaPrioridade,
  type TarefaStatus,
} from "@/lib/tarefas-types";
import { PrazoBadge } from "./tarefas-tab";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 flex flex-col"
      >
        {q.isLoading || !tarefa ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DrawerBody
            tarefa={tarefa}
            profiles={(profilesQ.data?.profiles ?? []).map((p) => ({
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
      </SheetContent>
    </Sheet>
  );
}

type Patch = {
  titulo?: string;
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
  responsavel_ids?: string[];
  prazo?: string;
  descricao?: string | null;
  // origem handled separately (origem + data_reuniao)
};

function DrawerBody({
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
  // Local mirror of server state (kept in sync when tarefa updates).
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  // Non-text fields don't need local state — selects/datepickers commit instantly.

  // Track snapshot from server to detect external updates.
  const serverSnapshot = useRef({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? "",
  });
  useEffect(() => {
    if (tarefa.titulo !== serverSnapshot.current.titulo) {
      setTitulo(tarefa.titulo);
      serverSnapshot.current.titulo = tarefa.titulo;
    }
    const desc = tarefa.descricao ?? "";
    if (desc !== serverSnapshot.current.descricao) {
      setDescricao(desc);
      serverSnapshot.current.descricao = desc;
    }
  }, [tarefa.titulo, tarefa.descricao]);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = () => {
    setSaveState("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1500);
  };

  const save = async (patch: Patch | Record<string, unknown>) => {
    setSaveState("saving");
    try {
      await onUpdate(patch as Record<string, unknown>);
      flashSaved();
    } catch (e) {
      setSaveState("error");
      toast.error((e as Error).message || "Falha ao salvar");
    }
  };

  // Debounced save for text inputs (titulo/descricao).
  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>(
    {},
  );
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

  // ---------- handlers ----------
  const onTituloChange = (v: string) => {
    setTitulo(v);
    if (v.trim().length === 0) return;
    debouncedSave("titulo", { titulo: v.trim() });
  };
  const onDescricaoChange = (v: string) => {
    setDescricao(v);
    debouncedSave("descricao", { descricao: v.length === 0 ? null : v });
  };
  const onDescricaoBlur = () => {
    if (debouncers.current.descricao) {
      clearTimeout(debouncers.current.descricao);
      debouncers.current.descricao = null;
    }
    const current = serverSnapshot.current.descricao ?? "";
    if (descricao !== current) {
      void save({ descricao: descricao.length === 0 ? null : descricao });
    }
  };

  const onStatusChange = (v: TarefaStatus) => void save({ status: v });
  const onPrioChange = (v: TarefaPrioridade) => void save({ prioridade: v });
  const onResponsaveisChange = (ids: string[]) =>
    void save({ responsavel_ids: ids });
  const onPrazoChange = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    void save({ prazo: iso });
  };
  const onOrigemChange = (v: TarefaOrigem) => {
    if (v === "ad_hoc") {
      void save({ origem: v, data_reuniao: null });
    } else {
      void save({
        origem: v,
        data_reuniao: tarefa.data_reuniao ?? format(new Date(), "yyyy-MM-dd"),
      });
    }
  };
  const onDataReuniaoChange = (date: Date | undefined) => {
    if (!date) return;
    void save({ data_reuniao: format(date, "yyyy-MM-dd") });
  };

  const isConcluida = tarefa.status === "concluida";

  const criadoPorNome = useMemo(() => {
    const p = profiles.find((x) => x.id === tarefa.criado_por_id);
    return p?.label ?? "—";
  }, [profiles, tarefa.criado_por_id]);

  return (
    <>
      <SheetHeader className="px-5 py-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="text-base font-semibold">
            Editar tarefa
          </SheetTitle>
          <SaveIndicator state={saveState} />
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Título */}
        <div className="space-y-1.5">
          <Label htmlFor="td-titulo" className="text-xs">
            Título
          </Label>
          <Input
            id="td-titulo"
            value={titulo}
            onChange={(e) => onTituloChange(e.target.value)}
            className={cn(
              "text-base font-semibold h-10",
              isConcluida && "line-through text-muted-foreground",
            )}
          />
        </div>

        {/* Status + Prioridade */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={tarefa.status} onValueChange={(v) => onStatusChange(v as TarefaStatus)}>
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
            <Label className="text-xs">Prioridade</Label>
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

        {/* Responsáveis */}
        <div className="space-y-1.5">
          <Label className="text-xs">Responsáveis</Label>
          <MultiProfileSelect
            options={profiles}
            value={tarefa.responsavel_ids}
            onChange={onResponsaveisChange}
            placeholder="Selecione"
          />
        </div>

        {/* Prazo */}
        <div className="space-y-1.5">
          <Label className="text-xs">Prazo</Label>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-9 w-[180px] justify-start font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {tarefa.prazo
                    ? format(new Date(tarefa.prazo + "T00:00:00"), "dd/MM/yyyy")
                    : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    tarefa.prazo ? new Date(tarefa.prazo + "T00:00:00") : undefined
                  }
                  onSelect={onPrazoChange}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs">
              <PrazoBadge prazo={tarefa.prazo} concluida={isConcluida} />
            </span>
          </div>
        </div>

        {/* Projeto (read-only) */}
        <div className="space-y-1.5">
          <Label className="text-xs">Projeto</Label>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/30">
            <span className="text-sm truncate flex-1">{tarefa.projeto_nome}</span>
            <Badge variant="outline" className="text-[10px]">
              {tarefa.projeto_tipo === "ma" ? "M&A" : "NN"}
            </Badge>
          </div>
        </div>

        {/* Origem */}
        <div className="space-y-1.5">
          <Label className="text-xs">Origem</Label>
          <Select
            value={tarefa.origem}
            onValueChange={(v) => onOrigemChange(v as TarefaOrigem)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORIGEM_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tarefa.origem === "reuniao_pipeline" && (
            <div className="mt-2">
              <Label className="text-xs">Data da reunião</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-[180px] justify-start font-normal mt-1"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tarefa.data_reuniao
                      ? format(
                          new Date(tarefa.data_reuniao + "T00:00:00"),
                          "dd/MM/yyyy",
                        )
                      : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      tarefa.data_reuniao
                        ? new Date(tarefa.data_reuniao + "T00:00:00")
                        : undefined
                    }
                    onSelect={onDataReuniaoChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor="td-desc" className="text-xs">
            Observação
          </Label>
          <Textarea
            id="td-desc"
            value={descricao}
            onChange={(e) => onDescricaoChange(e.target.value)}
            onBlur={onDescricaoBlur}
            placeholder="Observação, contexto, links..."
            rows={5}
          />
        </div>
      </div>

      {/* Rodapé */}
      <div className="border-t px-5 py-3 space-y-2 bg-muted/20">
        <div className="text-[11px] text-muted-foreground">
          Criado por <span className="font-medium">{criadoPorNome}</span> em{" "}
          {format(new Date(tarefa.created_at), "dd/MM/yyyy")}
        </div>
        <button
          type="button"
          onClick={onNavigateToProjeto}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Projeto: {tarefa.projeto_nome}
        </button>
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
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
        <X className="h-3 w-3" />
        Erro
      </span>
    );
  }
  return null;
}
