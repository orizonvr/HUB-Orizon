import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { updateTarefa } from "@/lib/tarefas.functions";
import type { TarefaComContexto } from "@/lib/tarefas-types";
import { TarefaMiniCard } from "./tarefas-cards-view";

type ProjetoLite = { id: string; nome: string; tipo: "ma" | "novos_negocios" };

type Props = {
  tarefas: TarefaComContexto[];
  filteredTarefas: TarefaComContexto[];
  /** All projetos that should appear as columns (filtered by scopeTipos). */
  projetos: ProjetoLite[];
  /** Only projects of these tipo(s) can act as columns. */
  scopeTipos: Array<"ma" | "novos_negocios">;
  /** Whether to ask for confirmation when moving across tipos (only true in global view). */
  allowCrossTipo: boolean;
  showTipoBadge: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
};

type PendingMove = {
  tarefa: TarefaComContexto;
  destinoProjeto: ProjetoLite;
};

export function TarefasKanbanView({
  tarefas,
  filteredTarefas,
  projetos,
  scopeTipos,
  allowCrossTipo,
  showTipoBadge,
  onOpenTask,
}: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // Build columns from ALL projetos restricted to scopeTipos.
  // Empty columns (no tarefas or filtered out) still render.
  const columns: ProjetoLite[] = useMemo(() => {
    return projetos
      .filter((p) => scopeTipos.includes(p.tipo))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [projetos, scopeTipos]);

  const byColumn = useMemo(() => {
    const m = new Map<string, TarefaComContexto[]>();
    for (const c of columns) m.set(c.id, []);
    for (const t of filteredTarefas) {
      const arr = m.get(t.projeto_id);
      if (arr) arr.push(t);
    }
    // sort by prazo ascending within each column
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
    }
    return m;
  }, [columns, filteredTarefas]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const moveMut = useMutation({
    mutationFn: (vars: { id: string; projeto_id: string }) =>
      updateFn({
        data: { id: vars.id, patch: { projeto_id: vars.projeto_id } },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const persistMove = (tarefa: TarefaComContexto, destino: ProjetoLite) => {
    const origemId = tarefa.projeto_id;
    moveMut.mutate({ id: tarefa.id, projeto_id: destino.id });
    toast.success(`Tarefa movida para ${destino.nome}`, {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () =>
          moveMut.mutate({ id: tarefa.id, projeto_id: origemId }),
      },
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const tarefaId = String(e.active.id);
    const destinoId = String(e.over.id);
    const tarefa = filteredTarefas.find((x) => x.id === tarefaId);
    const destino = columns.find((c) => c.id === destinoId);
    if (!tarefa || !destino) return;
    if (tarefa.projeto_id === destino.id) return;
    if (!allowCrossTipo && tarefa.projeto_tipo !== destino.tipo) {
      toast.error("Não é possível mover entre tipos diferentes nesta view.");
      return;
    }
    if (allowCrossTipo && tarefa.projeto_tipo !== destino.tipo) {
      setPendingMove({ tarefa, destinoProjeto: destino });
      return;
    }
    persistMove(tarefa, destino);
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  if (columns.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nenhum projeto com tarefas para exibir.
      </Card>
    );
  }

  const activeTarefa =
    activeId != null ? filteredTarefas.find((t) => t.id === activeId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              tarefas={byColumn.get(col.id) ?? []}
              showTipoBadge={showTipoBadge}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTarefa ? (
            <div className="w-[300px] rotate-1">
              <TarefaMiniCard
                t={activeTarefa}
                showTipo={showTipoBadge}
                onOpenTask={() => {}}
                dragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AlertDialog
        open={pendingMove !== null}
        onOpenChange={(o) => !o && setPendingMove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover entre tipos diferentes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove && (
                <>
                  Você está movendo a tarefa de{" "}
                  <strong>
                    {pendingMove.tarefa.projeto_tipo === "ma"
                      ? "M&A"
                      : "Novos Negócios"}
                  </strong>{" "}
                  para{" "}
                  <strong>
                    {pendingMove.destinoProjeto.tipo === "ma"
                      ? "M&A"
                      : "Novos Negócios"}
                  </strong>
                  . Confirmar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove) {
                  persistMove(pendingMove.tarefa, pendingMove.destinoProjeto);
                  setPendingMove(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function KanbanColumn({
  col,
  tarefas,
  showTipoBadge,
  onOpenTask,
}: {
  col: ProjetoLite;
  tarefas: TarefaComContexto[];
  showTipoBadge: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[320px] snap-start flex flex-col rounded-lg border bg-card transition-colors ${
        isOver ? "ring-2 ring-primary/40 bg-accent/30" : ""
      }`}
    >
      <div className="px-3 py-2.5 border-b bg-muted/40 rounded-t-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate" title={col.nome}>
            {col.nome}
          </h3>
          <span className="text-xs text-muted-foreground shrink-0">
            · {tarefas.length}
          </span>
        </div>
        {showTipoBadge && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {col.tipo === "ma" ? "M&A" : "NN"}
          </Badge>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] p-2 space-y-2">
        {tarefas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-1.5">
            <Check className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/70">
              Nenhuma tarefa pendente
            </span>
          </div>
        ) : (
          tarefas.map((t) => (
            <DraggableCard key={t.id} t={t} showTipo={showTipoBadge} onOpenTask={onOpenTask} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  t,
  showTipo,
  onOpenTask,
}: {
  t: TarefaComContexto;
  showTipo: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: t.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-30" : ""}
    >
      <TarefaMiniCard t={t} showTipo={showTipo} onOpenTask={onOpenTask} />
    </div>
  );
}
