import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ListTodo,
  AlertTriangle,
  CalendarClock,
  BookmarkCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TarefaComContexto } from "@/lib/tarefas-types";

export interface QuickFilters {
  fStatus: string;
  fPrazo: string;
  fClassificacao: string;
}

interface TarefasKpiStripProps {
  tarefas: TarefaComContexto[];
  isLoading?: boolean;
  filters: QuickFilters;
  onFilterChange: (patch: Partial<QuickFilters>) => void;
}

export function TarefasKpiStrip({
  tarefas,
  isLoading,
  filters,
  onFilterChange,
}: TarefasKpiStripProps) {
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ativas = tarefas.filter(
      (t) => t.status === "pendente" || t.status === "em_andamento",
    );
    const emAndamento = ativas.filter((t) => t.status === "em_andamento").length;
    const projetosImpactados = new Set(ativas.map((t) => t.projeto_id)).size;

    let atrasadasCount = 0;
    let atrasadasAltaCount = 0;
    let vencem7dCount = 0;
    let vencemHojeCount = 0;
    let acompanhamentosCount = 0;
    let dependemTerceirosCount = 0;

    for (const t of ativas) {
      if (t.tipo === "acompanhamento") {
        acompanhamentosCount++;
      }
      if (t.dependencia_terceiro) {
        dependemTerceirosCount++;
      }

      if (t.prazo) {
        const prazoDate = new Date(t.prazo + "T00:00:00");
        const diffDays = Math.round(
          (prazoDate.getTime() - today.getTime()) / 86_400_000,
        );

        if (diffDays < 0) {
          atrasadasCount++;
          if (t.prioridade === "alta") atrasadasAltaCount++;
        } else if (diffDays === 0) {
          vencemHojeCount++;
          vencem7dCount++;
        } else if (diffDays <= 7) {
          vencem7dCount++;
        }
      }
    }

    return {
      totalAtivas: ativas.length,
      emAndamento,
      projetosImpactados,
      atrasadas: atrasadasCount,
      atrasadasAlta: atrasadasAltaCount,
      vencem7d: vencem7dCount,
      vencemHoje: vencemHojeCount,
      acompanhamentos: acompanhamentosCount,
      dependemTerceiros: dependemTerceirosCount,
    };
  }, [tarefas]);

  const isAtrasadasActive = filters.fPrazo === "vencidas";
  const isVencem7dActive = filters.fPrazo === "7d";
  const isAcompanhamentoActive = filters.fClassificacao === "acompanhamento";
  const isAtivasOnly =
    filters.fStatus === "ativas" &&
    filters.fPrazo === "todos" &&
    filters.fClassificacao === "all";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Card: Total Ativas */}
      <Card
        onClick={() => {
          onFilterChange({
            fStatus: "ativas",
            fPrazo: "todos",
            fClassificacao: "all",
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isAtivasOnly && "ring-2 ring-primary/80 border-primary bg-primary/2",
        )}
      >
        <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground tracking-tight">
              Tarefas Ativas
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
              Escopo
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
            <ListTodo className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.totalAtivas}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  ativas
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              {metrics.emAndamento} em andamento
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary text-[10px] shrink-0">
              {metrics.projetosImpactados} projetos
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Card: Atrasadas / Críticas */}
      <Card
        onClick={() => {
          onFilterChange({
            fPrazo: isAtrasadasActive ? "todos" : "vencidas",
            fStatus: "ativas",
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-destructive/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          metrics.atrasadas > 0 && "border-destructive/35",
          isAtrasadasActive &&
            "ring-2 ring-destructive/80 border-destructive bg-destructive/3",
        )}
      >
        <div
          className={cn(
            "border-b px-3.5 py-2 flex items-center justify-between transition-colors",
            metrics.atrasadas > 0
              ? "bg-destructive/8 dark:bg-destructive/16 border-destructive/20 text-destructive"
              : "bg-muted/40 border-border/60 text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-tight">
              Atrasadas / Críticas
            </span>
            {metrics.atrasadas > 0 && (
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-destructive/15 text-destructive border border-destructive/25 shadow-2xs animate-pulse">
                Atenção
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex h-6.5 w-6.5 items-center justify-center rounded-md border bg-background transition-all duration-200 shadow-2xs",
              metrics.atrasadas > 0
                ? "border-destructive/30 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground group-hover:border-destructive"
                : "border-border/60 text-muted-foreground group-hover:text-foreground",
            )}
          >
            <AlertTriangle className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span
                  className={cn(
                    "text-2xl sm:text-[26px] font-extrabold tracking-tight tabular-nums",
                    metrics.atrasadas > 0
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {metrics.atrasadas}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  vencida{metrics.atrasadas === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span
              className={cn(
                "font-medium truncate",
                metrics.atrasadasAlta > 0 && "text-destructive font-semibold",
              )}
            >
              {metrics.atrasadasAlta > 0
                ? `${metrics.atrasadasAlta} de alta prioridade`
                : "Nenhuma de alta prioridade"}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span>{isAtrasadasActive ? "Filtrando" : "Filtrar"}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Card: Vencem em 7 Dias */}
      <Card
        onClick={() => {
          onFilterChange({
            fPrazo: isVencem7dActive ? "todos" : "7d",
            fStatus: "ativas",
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isVencem7dActive &&
            "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/5",
        )}
      >
        <div className="bg-amber-500/[0.07] dark:bg-amber-500/[0.14] border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground tracking-tight">
              Próximos 7 Dias
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
              Esta Semana
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-amber-500/25 bg-background text-amber-700 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 transition-all duration-200 shadow-2xs">
            <CalendarClock className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.vencem7d}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  prazo(s)
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              {metrics.vencemHoje > 0
                ? `${metrics.vencemHoje} vence(m) hoje`
                : "Nenhum vence hoje"}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span>{isVencem7dActive ? "Filtrando" : "Filtrar"}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Card: Acompanhamentos */}
      <Card
        onClick={() => {
          onFilterChange({
            fClassificacao: isAcompanhamentoActive ? "all" : "acompanhamento",
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-blue-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isAcompanhamentoActive &&
            "ring-2 ring-blue-500/80 border-blue-500 bg-blue-500/3",
        )}
      >
        <div className="bg-blue-500/[0.07] dark:bg-blue-500/[0.14] border-b border-blue-500/20 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground tracking-tight">
              Acompanhamentos
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
              Monitoramento
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-blue-500/25 bg-background text-blue-700 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200 shadow-2xs">
            <BookmarkCheck className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.acompanhamentos}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  itens
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              {metrics.dependemTerceiros} com terceiros
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span>{isAcompanhamentoActive ? "Filtrando" : "Filtrar"}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
