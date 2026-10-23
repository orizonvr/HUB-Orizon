import { useMemo, useState, useRef, useCallback, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AvatarStack } from "@/components/ui/avatar-stack";
import {
  Check,
  CheckSquare,
  Bookmark,
  Columns3,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  PRIORIDADE_LABEL,
  type TarefaComContexto,
  type TarefaPrioridade,
  type TarefaStatus,
} from "@/lib/tarefas-types";
import { PrazoBadge } from "./tarefas-tab";
import { useSessionCompleted } from "@/hooks/use-session-completed";

type ProjetoLite = { id: string; nome: string; tipo: "ma" | "novos_negocios" };

type Props = {
  tarefas: TarefaComContexto[];
  filteredTarefas: TarefaComContexto[];
  /** Todos os projetos que podem ser colunas (filtrados por scopeTipos). */
  projetos: ProjetoLite[];
  /** Apenas projetos destes tipos atuam como colunas. */
  scopeTipos: Array<"ma" | "novos_negocios">;
  /** Se deve pedir confirmação ao mover entre tipos diferentes (apenas na view global). */
  allowCrossTipo: boolean;
  showTipoBadge: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
  /** Estado controlado opcional para exibir apenas filas com cards */
  apenasComTarefas?: boolean;
  onApenasComTarefasChange?: (v: boolean) => void;
};

type PendingMove = {
  tarefa: TarefaComContexto;
  destinoProjeto: ProjetoLite;
};

const STORAGE_KEY_APENAS_COM_TAREFAS = "orizon:kanban-apenas-com-tarefas:v2";

export function TarefasKanbanView({
  filteredTarefas,
  projetos,
  scopeTipos,
  allowCrossTipo,
  showTipoBadge,
  onOpenTask,
  apenasComTarefas: controlledApenasComTarefas,
  onApenasComTarefasChange,
}: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // Fallback para estado não-controlado: padrão TRUE
  const [localApenasComTarefas, setLocalApenasComTarefas] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      localStorage.removeItem("orizon:kanban-apenas-com-tarefas");
      const saved = localStorage.getItem(STORAGE_KEY_APENAS_COM_TAREFAS);
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const isControlled = controlledApenasComTarefas !== undefined;
  const apenasComTarefas = isControlled
    ? controlledApenasComTarefas
    : localApenasComTarefas;

  const handleToggleApenasComTarefas = (checked: boolean) => {
    if (isControlled && onApenasComTarefasChange) {
      onApenasComTarefasChange(checked);
    } else {
      setLocalApenasComTarefas(checked);
    }
    try {
      localStorage.setItem(STORAGE_KEY_APENAS_COM_TAREFAS, String(checked));
    } catch {}
  };

  // Referência e controle de scroll horizontal com botões laterais
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 15);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 15);
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Rola aproximadamente 2 colunas inteiras (320px * 2 + 12px gap = ~652px)
    const offset = direction === "left" ? -680 : 680;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  // Constrói todas as colunas a partir dos projetos do escopo
  const allColumns: ProjetoLite[] = useMemo(() => {
    return projetos
      .filter((p) => scopeTipos.includes(p.tipo))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [projetos, scopeTipos]);

  // Agrupa tarefas filtradas por projeto/coluna
  const byColumn = useMemo(() => {
    const m = new Map<string, TarefaComContexto[]>();
    for (const c of allColumns) m.set(c.id, []);
    for (const t of filteredTarefas) {
      const arr = m.get(t.projeto_id);
      if (arr) arr.push(t);
    }
    // Ordena por prazo crescente dentro de cada coluna
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
    }
    return m;
  }, [allColumns, filteredTarefas]);

  // Colunas ativas com tarefas
  const colunasComTarefasCount = useMemo(() => {
    let count = 0;
    for (const col of allColumns) {
      if ((byColumn.get(col.id)?.length ?? 0) > 0) count++;
    }
    return count;
  }, [allColumns, byColumn]);

  // Colunas visíveis considerando o toggle "apenas com tarefas"
  const visibleColumns = useMemo(() => {
    if (!apenasComTarefas) return allColumns;
    return allColumns.filter((col) => (byColumn.get(col.id)?.length ?? 0) > 0);
  }, [allColumns, apenasComTarefas, byColumn]);

  // Atualiza indicadores de scroll sempre que as colunas mudarem ou janela for redimensionada
  useEffect(() => {
    const timer = setTimeout(checkScrollability, 60);
    const handleResize = () => checkScrollability();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [checkScrollability, visibleColumns]);

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
    const destino = allColumns.find((c) => c.id === destinoId);
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

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(String(e.active.id));

  const activeTarefa =
    activeId != null ? filteredTarefas.find((t) => t.id === activeId) : null;

  if (allColumns.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground rounded-xl border border-border/80">
        Nenhum projeto disponível para exibir no Kanban.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* BARRA DE CONTROLE DO KANBAN */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Columns3 className="h-4 w-4 text-primary shrink-0" />
          <span>
            Mostrando{" "}
            <strong className="text-foreground font-semibold">
              {visibleColumns.length}
            </strong>{" "}
            de {allColumns.length} filas de projetos
          </span>
          <span className="text-border">•</span>
          <span>
            <strong className="text-foreground font-semibold">
              {filteredTarefas.length}
            </strong>{" "}
            tarefas distribuídas
          </span>
        </div>

        {/* Toggle para apenas filas com tarefas */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-1.5 shadow-2xs">
            <Switch
              id="kanban-toggle-apenas-com-tarefas"
              checked={apenasComTarefas}
              onCheckedChange={handleToggleApenasComTarefas}
              className="cursor-pointer"
            />
            <Label
              htmlFor="kanban-toggle-apenas-com-tarefas"
              className="text-xs font-medium cursor-pointer text-foreground flex items-center gap-1.5 select-none"
            >
              <span>Apenas filas com tarefas</span>
              <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                {colunasComTarefasCount}
              </span>
            </Label>
          </div>
        </div>
      </div>

      {/* ESTADO VAZIO: SE O FILTRO ESTIVER ATIVO E NENHUMA FILA TIVER TAREFAS */}
      {visibleColumns.length === 0 ? (
        <Card className="p-12 text-center rounded-xl border border-dashed border-border/80 bg-card/60 flex flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Filter className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              Nenhuma fila com tarefas pendentes
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Todas as filas de projetos estão sem tarefas ativas para os filtros
              selecionados no momento.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleToggleApenasComTarefas(false)}
            className="mt-2 text-xs rounded-lg cursor-pointer"
          >
            Exibir todas as filas ({allColumns.length})
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="relative group/kanban">
            {/* Botão de Scroll para a Esquerda com Fade Lateral */}
            <div
              className={cn(
                "absolute left-0 top-0 bottom-3 w-14 z-20 pointer-events-none flex items-center justify-start bg-linear-to-r from-background via-background/70 to-transparent pl-1 transition-opacity duration-200",
                canScrollLeft ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleScroll("left")}
                aria-label="Rolar para esquerda"
                disabled={!canScrollLeft}
                className="pointer-events-auto h-9 w-9 rounded-full shadow-md border-border/80 bg-background/95 hover:bg-background hover:border-primary/50 text-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </Button>
            </div>

            {/* Container Horizontal de Colunas */}
            <div
              ref={scrollContainerRef}
              onScroll={checkScrollability}
              className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x scrollbar-thin scrollbar-thumb-border/80 hover:scrollbar-thumb-muted-foreground/40 scroll-smooth"
            >
              {visibleColumns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tarefas={byColumn.get(col.id) ?? []}
                  showTipoBadge={showTipoBadge}
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>

            {/* Botão de Scroll para a Direita com Fade Lateral */}
            <div
              className={cn(
                "absolute right-0 top-0 bottom-3 w-14 z-20 pointer-events-none flex items-center justify-end bg-linear-to-l from-background via-background/70 to-transparent pr-1 transition-opacity duration-200",
                canScrollRight ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleScroll("right")}
                aria-label="Rolar para direita"
                disabled={!canScrollRight}
                className="pointer-events-auto h-9 w-9 rounded-full shadow-md border-border/80 bg-background/95 hover:bg-background hover:border-primary/50 text-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>

          <DragOverlay>
            {activeTarefa ? (
              <div className="w-75">
                <KanbanCardItem
                  t={activeTarefa}
                  onOpenTask={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* CONFIRMAÇÃO DE MOVIMENTAÇÃO ENTRE TIPOS */}
      <AlertDialog
        open={pendingMove !== null}
        onOpenChange={(o) => !o && setPendingMove(null)}
      >
        <AlertDialogContent className="rounded-2xl">
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
                  . Deseja confirmar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
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
    </div>
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
      className={cn(
        "shrink-0 w-[320px] snap-start flex flex-col rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs transition-all duration-150 overflow-hidden",
        isOver && "ring-2 ring-primary/70 border-primary bg-primary/4",
      )}
    >
      {/* CABEÇALHO DA COLUNA */}
      <div className="px-3.5 py-2.5 border-b border-border/70 bg-primary/4 dark:bg-primary/8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="text-xs font-bold truncate text-foreground tracking-tight"
            title={col.nome}
          >
            {col.nome}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background border border-border/80 text-[10px] font-bold text-foreground px-1.5 shadow-2xs shrink-0">
            {tarefas.length}
          </span>
        </div>
        {showTipoBadge && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 rounded font-semibold border-primary/25 bg-background/90 text-primary shrink-0"
          >
            {col.tipo === "ma" ? "M&A" : "NN"}
          </Badge>
        )}
      </div>

      {/* ÁREA ROLÁVEL DE CARDS */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)] p-2.5 space-y-2.5 scrollbar-thin">
        {tarefas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-border/60 rounded-lg bg-muted/10 my-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60">
              <Check className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/80 font-medium">
              Fila vazia
            </span>
          </div>
        ) : (
          tarefas.map((t) => (
            <DraggableCard
              key={t.id}
              t={t}
              onOpenTask={onOpenTask}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  t,
  onOpenTask,
}: {
  t: TarefaComContexto;
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
      className={cn("group cursor-grab active:cursor-grabbing", isDragging && "opacity-25")}
    >
      <KanbanCardItem t={t} onOpenTask={onOpenTask} />
    </div>
  );
}

/**
 * Card moderno especializado para a fila do Kanban.
 * Focado no título, prazos, bloqueios de terceiros e subtarefas sem poluição visual.
 */
function KanbanCardItem({
  t,
  onOpenTask,
  isDragging,
}: {
  t: TarefaComContexto;
  onOpenTask: (t: TarefaComContexto) => void;
  isDragging?: boolean;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const session = useSessionCompleted();

  const mut = useMutation({
    mutationFn: (status: TarefaStatus) =>
      updateFn({ data: { id: t.id, patch: { status } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isConcluida = t.status === "concluida";
  const isAcompanhamento = t.tipo === "acompanhamento";
  const dimmed = isConcluida || t.status === "cancelada";

  // Identificação de atraso para cor semântica
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isAtrasada =
    !isConcluida &&
    !!t.prazo &&
    new Date(t.prazo + "T00:00:00").getTime() < today.getTime();

  // Acento lateral esquerdo de status/urgência
  const borderAccentClass = isConcluida
    ? "border-l-emerald-500/80"
    : isAtrasada
      ? "border-l-destructive"
      : isAcompanhamento
        ? "border-l-blue-500"
        : t.prioridade === "alta"
          ? "border-l-amber-500"
          : "border-l-primary/30";

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const previousStatus = t.status;
      session.markCompleted(t.id, previousStatus);
      mut.mutate("concluida");
      toast.success("Tarefa concluída", {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            session.clear(t.id);
            mut.mutate(previousStatus);
          },
        },
      });
    } else {
      session.clear(t.id);
      mut.mutate("pendente");
      toast.success("Tarefa reaberta");
    }
  };

  return (
    <Card
      className={cn(
        "p-3 rounded-xl border border-border/80 bg-card shadow-2xs transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-sm hover:-translate-y-0.5 flex flex-col gap-2.5 border-l-[3.5px]",
        borderAccentClass,
        dimmed && "opacity-60 bg-muted/20",
        isDragging && "shadow-xl ring-2 ring-primary/60 rotate-1 bg-card cursor-grabbing",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return;
        onOpenTask(t);
      }}
    >
      {/* 1. TOPO: CHECKBOX + TIPO (PADRÃO / ACOMPANHAMENTO) + PRIORIDADE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            data-no-card-click
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          >
            <Checkbox
              checked={isConcluida}
              onCheckedChange={(c) => handleToggle(c === true)}
              className="cursor-pointer transition-transform active:scale-90"
            />
          </div>

          {/* Badge explícito de Tipo da Tarefa */}
          {isAcompanhamento ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 shrink-0 gap-1 shadow-2xs"
            >
              <Bookmark className="h-2.5 w-2.5" />
              <span>Acompanhamento</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted/60 text-muted-foreground border-border/70 shrink-0 gap-1 shadow-2xs"
            >
              <CheckSquare className="h-2.5 w-2.5 text-muted-foreground/80" />
              <span>Padrão</span>
            </Badge>
          )}
        </div>

        <div className="shrink-0">
          <KanbanPrioPill p={t.prioridade} />
        </div>
      </div>

      {/* 2. TÍTULO DA TAREFA */}
      <h4
        className={cn(
          "text-xs font-semibold leading-snug line-clamp-2 text-foreground/95 group-hover:text-primary transition-colors",
          isConcluida && "line-through text-muted-foreground font-normal",
        )}
        title={t.titulo}
      >
        {t.titulo}
      </h4>

      {/* 3. DEPENDÊNCIA DE TERCEIROS (SE HOUVER) */}
      {(t.dependencia_terceiro || t.dependencia_nome) && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {t.dependencia_nome
              ? `Depende: ${t.dependencia_nome}`
              : "Depende de terceiros"}
          </span>
        </div>
      )}

      {/* 4. INDICATIVO DE SUBTAREFAS (EX: 2/4 COM MICRO BARRA DE PROGRESSO) */}
      {t.subtarefas_count && t.subtarefas_count > 0 ? (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/60 text-foreground text-[10px] font-medium"
          title={`${t.subtarefas_concluidas ?? 0} de ${t.subtarefas_count} subtarefas concluídas`}
        >
          <CheckSquare className="h-3 w-3 text-primary shrink-0" />
          <span className="font-semibold text-primary">
            {t.subtarefas_concluidas ?? 0}/{t.subtarefas_count}
          </span>
          <span className="text-muted-foreground">subtarefas</span>
          <div className="ml-auto w-12 h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${Math.round(((t.subtarefas_concluidas ?? 0) / t.subtarefas_count) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* 5. RODAPÉ: AVATAR DOS RESPONSÁVEIS + PRAZO */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
        <AvatarStack items={t.responsaveis} max={3} size="sm" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px]">
            <PrazoBadge prazo={t.prazo} concluida={isConcluida} />
          </span>
        </div>
      </div>
    </Card>
  );
}

function KanbanPrioPill({ p }: { p: TarefaPrioridade }) {
  const cls =
    p === "alta"
      ? "border-destructive/35 text-destructive bg-destructive/10 font-semibold"
      : p === "media"
        ? "border-amber-500/35 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium"
        : "text-muted-foreground border-border/70 bg-muted/30";
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0 rounded", cls)}
    >
      {PRIORIDADE_LABEL[p]}
    </Badge>
  );
}
