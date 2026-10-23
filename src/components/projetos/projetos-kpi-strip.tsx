import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Briefcase,
  AlertTriangle,
  BadgeDollarSign,
  Target,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, healthFor, type Health } from "@/lib/ma-utils";
import type { Projeto } from "@/lib/projetos.functions";
import type { ProjetoConfig } from "@/lib/projetos-config";

export interface ProjetosQuickFilters {
  filterStatus: string;
  filterHealth: "all" | "atencao";
  filterFaseAvancada: boolean;
}

interface ProjetosKpiStripProps {
  config: ProjetoConfig;
  projetos: Projeto[];
  isLoading?: boolean;
  filters: ProjetosQuickFilters;
  onFilterChange: (patch: Partial<ProjetosQuickFilters>) => void;
}

// Estágios considerados "Avançados / Decisórios"
const ESTAGIOS_AVANCADOS_MA = new Set([
  "nbo_submetida",
  "due_diligence",
  "negociacao",
  "opcao_compra_assinada",
  "assinatura_spa",
  "pos_ma_integracao",
]);

const ESTAGIOS_AVANCADOS_NN = new Set([
  "due_diligence",
  "estruturacao_aprovacao",
  "em_aprovacao_comite",
  "assinatura_contratos",
  "operacao_integracao",
]);

export function ProjetosKpiStrip({
  config,
  projetos,
  isLoading,
  filters,
  onFilterChange,
}: ProjetosKpiStripProps) {
  const isMA = config.tipo === "ma";
  const avancadosSet = isMA ? ESTAGIOS_AVANCADOS_MA : ESTAGIOS_AVANCADOS_NN;

  const metrics = useMemo(() => {
    const ativos = projetos.filter((p) => p.status === "ativo");
    const totalValorAtivos = ativos.reduce(
      (sum, p) => sum + Number(p.valor_estimado ?? 0),
      0,
    );
    const ticketMedio =
      ativos.length > 0 ? Math.round(totalValorAtivos / ativos.length) : 0;

    const avancados = ativos.filter((p) => avancadosSet.has(p.estagio));
    const avancadosValor = avancados.reduce(
      (sum, p) => sum + Number(p.valor_estimado ?? 0),
      0,
    );

    let criticosCount = 0;
    let atencaoCount = 0;
    for (const p of ativos) {
      const h = healthFor(p);
      if (h === "vermelho") criticosCount++;
      else if (h === "amarelo") atencaoCount++;
    }

    return {
      totalAtivos: ativos.length,
      totalProjetos: projetos.length,
      totalValorAtivos,
      ticketMedio,
      avancadosCount: avancados.length,
      avancadosValor,
      precisamAtencao: criticosCount + atencaoCount,
      criticosCount,
      atencaoCount,
    };
  }, [projetos, avancadosSet]);

  const isAtivosActive =
    filters.filterStatus === "ativo" &&
    filters.filterHealth === "all" &&
    !filters.filterFaseAvancada;
  const isAvancadosActive = filters.filterFaseAvancada;
  const isHealthActive = filters.filterHealth === "atencao";
  const isPipelineTotalActive =
    filters.filterStatus === "all" &&
    filters.filterHealth === "all" &&
    !filters.filterFaseAvancada;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Total Ativos */}
      <Card
        onClick={() => {
          if (isAtivosActive) {
            onFilterChange({ filterStatus: "all", filterFaseAvancada: false, filterHealth: "all" });
          } else {
            onFilterChange({ filterStatus: "ativo", filterFaseAvancada: false, filterHealth: "all" });
          }
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isAtivosActive && "ring-2 ring-primary/80 border-primary bg-primary/2",
        )}
      >
        <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground tracking-tight">
              Projetos Ativos
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
              Pipeline
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
            {isMA ? <Briefcase className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.totalAtivos}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  de {metrics.totalProjetos} total
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              Ticket médio: {formatBRL(metrics.ticketMedio)}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary text-[10px] shrink-0">
              {metrics.totalProjetos > 0
                ? `${Math.round((metrics.totalAtivos / metrics.totalProjetos) * 100)}% ativos`
                : "0%"}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Volume Total do Pipeline */}
      <Card
        onClick={() => {
          onFilterChange({
            filterStatus: isPipelineTotalActive ? "ativo" : "all",
            filterHealth: "all",
            filterFaseAvancada: false,
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isPipelineTotalActive && "ring-2 ring-primary/80 border-primary bg-primary/2",
        )}
      >
        <div className="bg-emerald-500/[0.07] dark:bg-emerald-500/[0.14] border-b border-emerald-500/15 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-emerald-950 dark:text-emerald-200 tracking-tight">
              Capital Mapeado
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs">
              Valor
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-emerald-500/20 bg-background text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-200 shadow-2xs">
            <BadgeDollarSign className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-28 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {formatBRL(metrics.totalValorAtivos)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  em pipeline
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              {config.subtituloSuffix}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[10px] shrink-0">
              Alocação Orizon
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Fase Avançada / Decisória */}
      <Card
        onClick={() => {
          onFilterChange({
            filterFaseAvancada: !isAvancadosActive,
            filterHealth: "all",
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isAvancadosActive && "ring-2 ring-primary/80 border-primary bg-primary/2",
        )}
      >
        <div className="bg-blue-500/[0.07] dark:bg-blue-500/[0.14] border-b border-blue-500/15 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-blue-950 dark:text-blue-200 tracking-tight">
              Fase Decisória
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-blue-700 dark:text-blue-300 border border-blue-500/20 shadow-2xs">
              Hot Deals
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-blue-500/20 bg-background text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200 shadow-2xs">
            <Target className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.avancadosCount}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  deals ({formatBRL(metrics.avancadosValor)})
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              DD, Negociação ou Comitê
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 text-[10px] shrink-0">
              {isAvancadosActive ? "Filtro ativo" : "Filtrar"}
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Saúde & Atenção */}
      <Card
        onClick={() => {
          onFilterChange({
            filterHealth: isHealthActive ? "all" : "atencao",
            filterFaseAvancada: false,
          });
        }}
        className={cn(
          "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
          isHealthActive && "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/2",
        )}
      >
        <div className="bg-amber-500/8 dark:bg-amber-500/15 border-b border-amber-500/15 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-amber-950 dark:text-amber-200 tracking-tight">
              Requerem Atenção
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-2xs">
              Status & Prazos
            </span>
          </div>
          <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-amber-500/20 bg-background text-amber-600 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 transition-all duration-200 shadow-2xs">
            <AlertTriangle className="h-3 w-3" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
            ) : (
              <div className="flex items-baseline tracking-tight">
                <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                  {metrics.precisamAtencao}
                </span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                  em alerta
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80 truncate">
              {metrics.criticosCount} críticos • {metrics.atencaoCount} atenção
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 text-[10px] shrink-0">
              {isHealthActive ? "Filtro ativo" : "Filtrar"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
