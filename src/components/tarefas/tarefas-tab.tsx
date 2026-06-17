import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { Plus, MoreHorizontal, Loader2, Inbox, Calendar, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  listTarefasByProjeto,
  updateTarefa,
  deleteTarefa,
} from "@/lib/tarefas.functions";
import {
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  ORIGEM_LABEL,
  type Tarefa,
  type TarefaPrioridade,
  type TarefaStatus,
} from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { NovaTarefaDialog } from "./nova-tarefa-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSessionCompleted } from "@/hooks/use-session-completed";
import { useTarefaDrawer } from "@/hooks/use-tarefa-drawer";

type Props = {
  projetoId: string;
  projetoNome: string;
  profiles: Profile[];
  currentUserId: string | null;
};

const STATUS_ORDER: TarefaStatus[] = [
  "pendente",
  "em_andamento",
  "concluida",
  "cancelada",
];

export function TarefasTab({
  projetoId,
  projetoNome,
  profiles,
  currentUserId,
}: Props) {
  const fetchFn = useServerFn(listTarefasByProjeto);
  const q = useQuery({
    queryKey: ["tarefas-projeto", projetoId],
    queryFn: () => fetchFn({ data: { projeto_id: projetoId } }),
  });
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const session = useSessionCompleted();

  const grupos = useMemo(() => {
    const map: Record<TarefaStatus, Tarefa[]> = {
      pendente: [],
      em_andamento: [],
      concluida: [],
      cancelada: [],
    };
    for (const t of q.data?.tarefas ?? []) {
      // Keep just-completed rows in their ORIGINAL bucket until reload.
      const displayStatus = session.originalStatus(t.id) ?? t.status;
      map[displayStatus].push(t);
    }
    return map;
  }, [q.data, session]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tarefas vinculadas a este projeto.
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova tarefa
        </Button>
      </div>

      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!q.isLoading && (q.data?.tarefas.length ?? 0) === 0 && (
        <div className="text-center py-10 rounded-md border border-dashed">
          <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma tarefa ainda. Crie a primeira para começar.
          </p>
        </div>
      )}

      {!q.isLoading &&
        STATUS_ORDER.map((status) => {
          const items = grupos[status];
          if (items.length === 0) return null;
          return (
            <div key={status} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STATUS_LABEL[status]}
                </h4>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {items.map((t) => (
                  <TarefaRow
                    key={t.id}
                    tarefa={t}
                    profiles={profiles}
                    projetoId={projetoId}
                    currentUserId={currentUserId}
                    expanded={expandedId === t.id}
                    onToggleExpand={() =>
                      setExpandedId((prev) => (prev === t.id ? null : t.id))
                    }
                    onMarkCompleted={session.markCompleted}
                    onClearSticky={session.clear}
                  />
                ))}
              </div>
            </div>
          );
        })}

      <NovaTarefaDialog
        open={showNew}
        onOpenChange={setShowNew}
        profiles={profiles}
        projetoFixo={{ id: projetoId, nome: projetoNome }}
        defaultResponsavelId={currentUserId}
      />
    </div>
  );
}

function TarefaRow({
  tarefa,
  profiles,
  projetoId,
  currentUserId,
  expanded,
  onToggleExpand,
  onMarkCompleted,
  onClearSticky,
}: {
  tarefa: Tarefa;
  profiles: Profile[];
  projetoId: string;
  currentUserId: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onMarkCompleted: (id: string, previousStatus: TarefaStatus) => void;
  onClearSticky: (id: string) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const deleteFn = useServerFn(deleteTarefa);

  const mut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { id: tarefa.id, patch } }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["tarefas-projeto", projetoId] });
      const prev = qc.getQueryData<{ tarefas: Tarefa[] }>([
        "tarefas-projeto",
        projetoId,
      ]);
      if (prev) {
        qc.setQueryData(["tarefas-projeto", projetoId], {
          tarefas: prev.tarefas.map((t) =>
            t.id === tarefa.id ? { ...t, ...patch } : t,
          ),
        });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(["tarefas-projeto", projetoId], ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tarefas-projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });

  const handleToggleConcluida = (checked: boolean) => {
    if (checked) {
      const previousStatus = tarefa.status;
      onMarkCompleted(tarefa.id, previousStatus);
      mut.mutate({ status: "concluida" });
      toast.success("Tarefa concluída", {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            onClearSticky(tarefa.id);
            mut.mutate({ status: previousStatus });
          },
        },
      });
    } else {
      onClearSticky(tarefa.id);
      mut.mutate({ status: "pendente" });
    }
  };


  const delMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: tarefa.id } }),
    onSuccess: () => {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["tarefas-projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isConcluida = tarefa.status === "concluida";
  const isCancelada = tarefa.status === "cancelada";
  const dimmed = isConcluida || isCancelada;

  const canEdit =
    currentUserId === tarefa.criado_por_id ||
    (currentUserId != null && tarefa.responsavel_ids.includes(currentUserId));

  const hasDescricao = !!(tarefa.descricao && tarefa.descricao.trim().length > 0);

  const { openTarefa } = useTarefaDrawer();
  const stopClick = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="space-y-1">
      <div
        onClick={() => openTarefa(tarefa.id)}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer ${
          dimmed ? "opacity-60" : ""
        }`}
      >
        {hasDescricao ? (
          <button
            type="button"
            onClick={(e) => { stopClick(e); onToggleExpand(); }}
            aria-label={expanded ? "Recolher observação" : "Expandir observação"}
            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground -ml-1"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 -ml-1" />
        )}
        <span onClick={stopClick}>
          <Checkbox
            checked={isConcluida}
            disabled={!canEdit && false}
            onCheckedChange={(c) => handleToggleConcluida(c === true)}
          />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm truncate ${
              isConcluida ? "line-through" : ""
            }`}
          >
            {tarefa.titulo}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <PrazoBadge prazo={tarefa.prazo} concluida={isConcluida} />
            <span>·</span>
            <span>{ORIGEM_LABEL[tarefa.origem]}</span>
          </div>
        </div>

        <div onClick={stopClick}>
          <Select
            value={tarefa.prioridade}
            onValueChange={(v) => mut.mutate({ prioridade: v })}
          >
            <SelectTrigger
              className={`h-7 w-[88px] text-xs ${prioColor(tarefa.prioridade)}`}
            >
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

        <div className="w-[170px]" onClick={stopClick}>
          <MultiProfileSelect
            options={profiles.map((p) => ({ id: p.id, label: p.nome_completo }))}
            value={tarefa.responsavel_ids}
            onChange={(next) => mut.mutate({ responsavel_ids: next })}
            placeholder="Responsáveis"
            compact
            triggerClassName="h-7 text-xs"
          />
        </div>

        <Input
          type="date"
          value={tarefa.prazo}
          onClick={stopClick}
          onChange={(e) =>
            e.target.value && mut.mutate({ prazo: e.target.value })
          }
          className="h-7 w-[130px] text-xs"
        />

        <div onClick={stopClick}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => mut.mutate({ status: "em_andamento" })}
              >
                Marcar em andamento
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => mut.mutate({ status: "pendente" })}
              >
                Marcar pendente
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => mut.mutate({ status: "cancelada" })}
              >
                Cancelar tarefa
              </DropdownMenuItem>
              <ConfirmDialog
                title="Excluir tarefa?"
                description="Essa ação não pode ser desfeita."
                confirmLabel="Excluir"
                destructive
                onConfirm={async () => {
                  await delMut.mutateAsync();
                }}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    Excluir
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded && hasDescricao && (
        <div className="ml-8 mr-2 mb-1 px-3 py-2 rounded-md bg-muted/30">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {tarefa.descricao}
          </p>
        </div>
      )}
    </div>
  );
}

function prioColor(p: TarefaPrioridade): string {
  if (p === "alta") return "text-destructive border-destructive/40";
  if (p === "media") return "";
  return "text-muted-foreground";
}

export function PrazoBadge({
  prazo,
  concluida,
}: {
  prazo: string | null;
  concluida?: boolean;
}) {
  if (!prazo) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground italic">
        <Calendar className="h-3 w-3" />
        Sem prazo
      </span>
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const p = new Date(prazo + "T00:00:00");
  const diff = Math.round((p.getTime() - today.getTime()) / 86_400_000);
  const label = formatPrazoBR(prazo);
  let cls = "text-muted-foreground";
  let txt = label;
  if (!concluida) {
    if (diff < 0) {
      cls = "text-destructive font-medium";
      txt = `${label} · ${Math.abs(diff)}d atrasada`;
    } else if (diff === 0) {
      cls = "text-amber-600 font-medium";
      txt = `${label} · hoje`;
    } else if (diff <= 3) {
      cls = "text-amber-600";
      txt = `${label} · em ${diff}d`;
    }
  }
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <Calendar className="h-3 w-3" />
      {txt}
    </span>
  );
}

function formatPrazoBR(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(d);
}
