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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  Columns3,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  AlertCircle,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  formatBRL,
  formatMonthYear,
  healthFor,
  HEALTH_BG,
  HEALTH_LABEL,
  initials,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  avatarBgStyle,
  formatPercentOrizon,
  formatTonDia,
} from "@/lib/format";
import { SUBCATEGORIA_LABEL } from "@/lib/projetos-types";
import { updateProjeto, type Profile, type Projeto } from "@/lib/projetos.functions";
import type { ProjetoConfig } from "@/lib/projetos-config";

const ESTAGIOS_MA_TAREFAS_RAPIDAS = new Set([
  "nbo_submetida",
  "due_diligence",
  "negociacao",
  "opcao_compra_assinada",
  "assinatura_spa",
  "pos_ma_integracao",
]);

interface ProjetosKanbanViewProps {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
  onNovaTarefa?: (p: Projeto) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  apenasComProjetos?: boolean;
  onApenasComProjetosChange?: (checked: boolean) => void;
}

export function ProjetosKanbanView({
  config,
  projetos,
  profileMap,
  onOpen,
  onNovaTarefa,
  selectedIds = [],
  onToggleSelect,
  apenasComProjetos: controlledApenasComProjetos,
  onApenasComProjetosChange,
}: ProjetosKanbanViewProps) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateProjeto);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Storage key persistida
  const storageKey = `orizon:kanban-apenas-com-projetos:${config.tipo}:v2`;

  const [localApenasComProjetos, setLocalApenasComProjetos] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved === "true" : false;
    } catch {
      return false;
    }
  });

  const isControlled = controlledApenasComProjetos !== undefined;
  const apenasComProjetos = isControlled
    ? controlledApenasComProjetos
    : localApenasComProjetos;

  const handleToggleApenasComProjetos = (checked: boolean) => {
    if (isControlled && onApenasComProjetosChange) {
      onApenasComProjetosChange(checked);
    } else {
      setLocalApenasComProjetos(checked);
    }
    try {
      localStorage.setItem(storageKey, String(checked));
    } catch {}
  };

  // Scroll horizontal com botões laterais (ChevronLeft / ChevronRight)
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
    const offset = direction === "left" ? -680 : 680;
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  // Mapeamento por estágio
  const byStage = useMemo(() => {
    const map = new Map<string, Projeto[]>();
    for (const s of config.estagios) map.set(s.key, []);
    for (const p of projetos) {
      const arr = map.get(p.estagio);
      if (arr) arr.push(p);
    }
    return map;
  }, [projetos, config.estagios]);

  const colunasComProjetosCount = useMemo(() => {
    let count = 0;
    for (const s of config.estagios) {
      if ((byStage.get(s.key)?.length ?? 0) > 0) count++;
    }
    return count;
  }, [config.estagios, byStage]);

  // Colunas visíveis
  const visibleColumns = useMemo(() => {
    if (!apenasComProjetos) return config.estagios;
    return config.estagios.filter((s) => (byStage.get(s.key)?.length ?? 0) > 0);
  }, [config.estagios, apenasComProjetos, byStage]);

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
    mutationFn: (vars: { id: string; estagio: string }) =>
      updateFn({ data: { id: vars.id, patch: { estagio: vars.estagio } } }),
    onMutate: async ({ id, estagio }) => {
      await qc.cancelQueries({ queryKey: [config.queryKey] });
      const prev = qc.getQueryData([config.queryKey]) as
        | { projetos: Projeto[] }
        | undefined;
      if (prev) {
        qc.setQueryData([config.queryKey], {
          projetos: prev.projetos.map((p) =>
            p.id === id ? { ...p, estagio } : p,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([config.queryKey], ctx.prev);
      toast.error("Falha ao mover projeto");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [config.queryKey] }),
  });

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const projetoId = String(e.active.id);
    const destinoEstagio = String(e.over.id);
    const projeto = projetos.find((p) => p.id === projetoId);
    if (!projeto || projeto.estagio === destinoEstagio) return;

    const estagioOrigem = projeto.estagio;
    const destinoLabel =
      config.estagioLabels[destinoEstagio] ?? destinoEstagio;

    moveMut.mutate({ id: projeto.id, estagio: destinoEstagio });

    toast.success(`Projeto movido para "${destinoLabel}"`, {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          moveMut.mutate({ id: projeto.id, estagio: estagioOrigem });
        },
      },
    });
  };

  const activeProjeto =
    activeId != null ? projetos.find((p) => p.id === activeId) : null;

  const totalValorFiltrado = useMemo(() => {
    return projetos.reduce(
      (sum, p) => sum + Number(p.valor_estimado ?? 0),
      0,
    );
  }, [projetos]);

  return (
    <div className="space-y-3">
      {/* 1. BARRA DE CONTROLE DO KANBAN */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Columns3 className="h-4 w-4 text-primary shrink-0" />
          <span>
            Mostrando{" "}
            <strong className="text-foreground font-semibold">
              {visibleColumns.length}
            </strong>{" "}
            de {config.estagios.length} estágios
          </span>
          <span className="text-border">•</span>
          <span>
            <strong className="text-foreground font-semibold">
              {projetos.length}
            </strong>{" "}
            projetos distribuídos
          </span>
          <span className="text-border">•</span>
          <span>
            <strong className="text-foreground font-semibold font-mono">
              {formatBRL(totalValorFiltrado)}
            </strong>{" "}
            {config.subtituloSuffix}
          </span>
        </div>

        {/* Toggle para apenas estágios com projetos */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-1.5 shadow-2xs">
            <Switch
              id="kanban-toggle-apenas-com-projetos"
              checked={apenasComProjetos}
              onCheckedChange={handleToggleApenasComProjetos}
              className="cursor-pointer"
            />
            <Label
              htmlFor="kanban-toggle-apenas-com-projetos"
              className="text-xs font-medium cursor-pointer text-foreground flex items-center gap-1.5 select-none"
            >
              <span>Apenas estágios com projetos</span>
              <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-bold">
                {colunasComProjetosCount}
              </span>
            </Label>
          </div>
        </div>
      </div>

      {/* 2. ESTADO VAZIO: SE O FILTRO ESTIVER ATIVO E NENHUM ESTÁGIO TIVER PROJETOS */}
      {visibleColumns.length === 0 ? (
        <Card className="p-12 text-center rounded-xl border border-dashed border-border/80 bg-card/60 flex flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Filter className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">
              Nenhum estágio com projetos ativos
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Todos os estágios estão sem projetos para os filtros selecionados no
              momento.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleToggleApenasComProjetos(false)}
            className="mt-2 text-xs rounded-lg cursor-pointer"
          >
            Exibir todos os estágios ({config.estagios.length})
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
              {visibleColumns.map((estagio) => {
                const items = byStage.get(estagio.key) ?? [];
                return (
                  <KanbanStageColumn
                    key={estagio.key}
                    estagioKey={estagio.key}
                    estagioLabel={estagio.label}
                    projetos={items}
                    profileMap={profileMap}
                    config={config}
                    onOpen={onOpen}
                    onNovaTarefa={onNovaTarefa}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                  />
                );
              })}
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
            {activeProjeto ? (
              <div className="w-77.5">
                <KanbanProjectCardItem
                  projeto={activeProjeto}
                  profile={
                    activeProjeto.responsavel_id
                      ? profileMap.get(activeProjeto.responsavel_id)
                      : undefined
                  }
                  config={config}
                  onOpen={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function KanbanStageColumn({
  estagioKey,
  estagioLabel,
  projetos,
  profileMap,
  config,
  onOpen,
  onNovaTarefa,
  selectedIds,
  onToggleSelect,
}: {
  estagioKey: string;
  estagioLabel: string;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  config: ProjetoConfig;
  onOpen: (id: string) => void;
  onNovaTarefa?: (p: Projeto) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estagioKey });

  const totalColValor = useMemo(() => {
    return projetos.reduce(
      (sum, p) => sum + Number(p.valor_estimado ?? 0),
      0,
    );
  }, [projetos]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[320px] snap-start flex flex-col rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs transition-all duration-150 overflow-hidden",
        isOver && "ring-2 ring-primary/70 border-primary bg-primary/4",
      )}
    >
      {/* CABEÇALHO DA COLUNA (PADRÃO TAREFAS) */}
      <div className="px-3.5 py-2.5 border-b border-border/70 bg-primary/4 dark:bg-primary/8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="text-xs font-bold truncate text-foreground tracking-tight"
            title={estagioLabel}
          >
            {estagioLabel}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background border border-border/80 text-[10px] font-bold text-foreground px-1.5 shadow-2xs shrink-0">
            {projetos.length}
          </span>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[11px] font-mono font-bold text-primary">
            {formatBRL(totalColValor)}
          </span>
        </div>
      </div>

      {/* ÁREA ROLÁVEL DE CARDS */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)] p-2.5 space-y-2.5 scrollbar-thin">
        {projetos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-border/60 rounded-lg bg-muted/10 my-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60">
              <Check className="h-4 w-4" />
            </div>
            <span className="text-xs text-muted-foreground/80 font-medium">
              Fila vazia
            </span>
          </div>
        ) : (
          projetos.map((p) => (
            <DraggableProjectCard
              key={p.id}
              projeto={p}
              profile={
                p.responsavel_id ? profileMap.get(p.responsavel_id) : undefined
              }
              config={config}
              onOpen={onOpen}
              onNovaTarefa={onNovaTarefa}
              isSelected={selectedIds?.includes(p.id)}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableProjectCard({
  projeto,
  profile,
  config,
  onOpen,
  onNovaTarefa,
  isSelected,
  onToggleSelect,
}: {
  projeto: Projeto;
  profile?: Profile;
  config: ProjetoConfig;
  onOpen: (id: string) => void;
  onNovaTarefa?: (p: Projeto) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: projeto.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab active:cursor-grabbing",
        isDragging && "opacity-25",
      )}
    >
      <KanbanProjectCardItem
        projeto={projeto}
        profile={profile}
        config={config}
        onOpen={onOpen}
        onNovaTarefa={onNovaTarefa}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
}

/**
 * Card moderno para o Kanban de Projetos (M&A e Novos Negócios).
 * Segue rigorosamente a tipografia, dimensões e acentos laterais da página de tarefas.
 */
function KanbanProjectCardItem({
  projeto,
  profile,
  config,
  onOpen,
  onNovaTarefa,
  isSelected = false,
  onToggleSelect,
  isDragging = false,
}: {
  projeto: Projeto;
  profile?: Profile;
  config: ProjetoConfig;
  onOpen: (id: string) => void;
  onNovaTarefa?: (p: Projeto) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isDragging?: boolean;
}) {
  const h = healthFor(projeto);
  const canQuickTask =
    projeto.tipo === "novos_negocios" ||
    ESTAGIOS_MA_TAREFAS_RAPIDAS.has(projeto.estagio);

  // Acento lateral esquerdo de saúde/urgência (padrão 3.5px como tarefas)
  const borderAccentClass =
    h === "vermelho"
      ? "border-l-destructive"
      : h === "amarelo"
        ? "border-l-amber-500"
        : "border-l-emerald-500/90";

  return (
    <Card
      className={cn(
        "p-3 rounded-xl border border-border/80 bg-card shadow-2xs transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-sm hover:-translate-y-0.5 flex flex-col gap-2.5 border-l-[3.5px]",
        borderAccentClass,
        isSelected && "ring-2 ring-primary/80 border-primary bg-primary/2",
        isDragging &&
          "shadow-xl ring-2 ring-primary/60 rotate-1 bg-card cursor-grabbing",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return;
        onOpen(projeto.id);
      }}
    >
      {/* 1. TOPO: CHECKBOX DE SELEÇÃO + BADGES DE SETOR / STATUS + SAÚDE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {onToggleSelect && (
            <div
              data-no-card-click
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(projeto.id)}
                className="cursor-pointer rounded transition-transform active:scale-90"
                aria-label="Selecionar projeto"
              />
            </div>
          )}

          {/* Badge de Setor */}
          {projeto.setor && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.2 rounded font-medium border-border/70 bg-muted/40 text-muted-foreground shrink-0 shadow-2xs"
            >
              {projeto.setor}
            </Badge>
          )}

          {/* Subcategoria (Novos Negócios) */}
          {projeto.subcategoria && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-primary/10 text-primary border-primary/20 shrink-0 shadow-2xs"
            >
              {SUBCATEGORIA_LABEL[projeto.subcategoria] ?? projeto.subcategoria}
            </Badge>
          )}

          {/* % Orizon (M&A) */}
          {projeto.tipo === "ma" &&
            projeto.percentual_orizon != null &&
            Number(projeto.percentual_orizon) !== 100 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0 shadow-2xs"
              >
                {formatPercentOrizon(projeto.percentual_orizon)} Orizon
              </Badge>
            )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${HEALTH_BG[h]}`}
              />
            </TooltipTrigger>
            <TooltipContent>{HEALTH_LABEL[h]}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 2. TÍTULO DO PROJETO E CONTRAPARTE */}
      <div className="space-y-0.5">
        <h4
          className="text-xs font-semibold leading-snug line-clamp-2 text-foreground/95 group-hover:text-primary transition-colors"
          title={projeto.nome}
        >
          {projeto.nome}
        </h4>
        {projeto.contraparte && (
          <div className="text-[10px] font-medium text-muted-foreground truncate">
            {projeto.contraparte}
          </div>
        )}
      </div>

      {/* 3. BLOCO DE MÉTRICA FINANCEIRA EM DESTAQUE */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-muted/25 border border-border/60">
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-bold text-primary font-mono tracking-tight">
            {formatBRL(projeto.valor_estimado)}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {config.tipo === "ma" ? "estimado" : "investimento"}
          </span>
        </div>

        {projeto.tipo === "ma" && projeto.volume_ton_dia != null && (
          <span className="text-[10px] font-mono font-medium text-muted-foreground">
            {formatTonDia(projeto.volume_ton_dia)}
          </span>
        )}
      </div>

      {/* 4. RODAPÉ: AVATAR DO RESPONSÁVEL + BOTÃO DE TAREFA + PREVISÃO */}
      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {profile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border border-border/70 shrink-0">
                  <AvatarFallback
                    className="text-[9px] font-bold"
                    style={avatarBgStyle(profile.nome_completo)}
                  >
                    {initials(profile.nome_completo)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{profile.nome_completo}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}

          {canQuickTask && onNovaTarefa && (
            <div data-no-card-click onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    onClick={() => onNovaTarefa(projeto)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    Tarefa
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar tarefa rápida para este deal</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span className="text-[10px] font-mono font-semibold">
            {formatMonthYear(projeto.data_fechamento_prevista)}
          </span>
        </div>
      </div>
    </Card>
  );
}
