import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  KanbanSquare,
  Table as TableIcon,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_POR_TIPO } from "@/lib/ma-utils";
import { SUBCATEGORIAS } from "@/lib/projetos-types";
import type { Profile } from "@/lib/projetos.functions";
import type { ProjetoConfig } from "@/lib/projetos-config";

export type ProjetosViewMode = "kanban" | "table" | "cards";

interface ProjetosFilterBarProps {
  config: ProjetoConfig;
  search: string;
  onSearchChange: (v: string) => void;
  filterEstagio: string;
  onEstagioChange: (v: string) => void;
  filterResp: string;
  onRespChange: (v: string) => void;
  filterSetor: string;
  onSetorChange: (v: string) => void;
  filterSubcategoria: string;
  onSubcategoriaChange: (v: string) => void;
  filterStatus: string;
  onStatusChange: (v: string) => void;
  filterMinVal: string;
  onMinValChange: (v: string) => void;
  filterMaxVal: string;
  onMaxValChange: (v: string) => void;
  profiles: Profile[];
  viewMode: ProjetosViewMode;
  onViewModeChange: (m: ProjetosViewMode) => void;
  totalProjetos: number;
  totalFiltered: number;
  onResetFilters: () => void;
  // Controle opcional de apenas colunas com projetos no Kanban
  kanbanApenasComProjetos?: boolean;
  onKanbanApenasComProjetosChange?: (checked: boolean) => void;
}

export function ProjetosFilterBar({
  config,
  search,
  onSearchChange,
  filterEstagio,
  onEstagioChange,
  filterResp,
  onRespChange,
  filterSetor,
  onSetorChange,
  filterSubcategoria,
  onSubcategoriaChange,
  filterStatus,
  onStatusChange,
  filterMinVal,
  onMinValChange,
  filterMaxVal,
  onMaxValChange,
  profiles,
  viewMode,
  onViewModeChange,
  totalProjetos,
  totalFiltered,
  onResetFilters,
  kanbanApenasComProjetos,
  onKanbanApenasComProjetosChange,
}: ProjetosFilterBarProps) {
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);

  // Conta filtros avançados ativos
  const advancedCount =
    (filterSetor !== "all" ? 1 : 0) +
    (config.tipo === "novos_negocios" && filterSubcategoria !== "all" ? 1 : 0) +
    (filterStatus !== "all" && filterStatus !== "ativo" ? 1 : 0) +
    (filterMinVal !== "" || filterMaxVal !== "" ? 1 : 0);

  // Verifica se há qualquer filtro ativo
  const hasActiveFilters =
    search.trim() !== "" ||
    filterEstagio !== "all" ||
    filterResp !== "all" ||
    filterStatus !== "all" ||
    advancedCount > 0;

  return (
    <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-3 space-y-2.5">
      {/* 1. LINHA PRIMÁRIA: BUSCA + FILTROS ESSENCIAIS + ALTERNADOR DE MODO */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nome ou contraparte..."
              className="pl-8 pr-7 h-9 rounded-lg bg-background border-border/80 focus-visible:ring-primary/25"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro de Estágio */}
          <Select value={filterEstagio} onValueChange={onEstagioChange}>
            <SelectTrigger className="w-40 sm:w-44 h-9 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-medium">
                Todos os estágios
              </SelectItem>
              {config.estagios.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Responsável */}
          <Select value={filterResp} onValueChange={onRespChange}>
            <SelectTrigger className="w-38 sm:w-42 h-9 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-medium">
                Todos os responsáveis
              </SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.nome_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botão de Filtros Avançados */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpandedAdvanced((prev) => !prev)}
            className={cn(
              "h-9 px-2.5 gap-1.5 text-xs rounded-lg border-border/80 transition-all",
              (expandedAdvanced || advancedCount > 0) &&
                "border-primary/50 bg-primary/5 text-primary font-semibold",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mais filtros</span>
            {advancedCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] font-mono bg-primary text-primary-foreground font-semibold"
              >
                {advancedCount}
              </Badge>
            )}
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform duration-200",
                expandedAdvanced && "rotate-180 text-primary",
              )}
            />
          </Button>

          {/* Botão Limpar Filtros */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          )}
        </div>

        {/* Lado Direito: Alternador de Visualização (Kanban, Tabela, Cards) + Contagem */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-muted-foreground font-medium hidden md:block">
            <span className="font-bold text-foreground tabular-nums">
              {totalFiltered}
            </span>{" "}
            de {totalProjetos} projetos
          </div>

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && onViewModeChange(v as ProjetosViewMode)}
            className="h-9 bg-muted/50 p-0.5 rounded-lg border border-border/80"
          >
            <ToggleGroupItem
              value="kanban"
              aria-label="Kanban"
              className="h-8 px-2.5 text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs gap-1.5"
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="table"
              aria-label="Tabela"
              className="h-8 px-2.5 text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs gap-1.5"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="cards"
              aria-label="Cards"
              className="h-8 px-2.5 text-xs font-medium rounded-md data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs gap-1.5"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* 2. CAMADA AVANÇADA (EXPANSÍVEL): SETOR, SUBCATEGORIA, STATUS, VALOR, KANBAN TOGGLE */}
      {expandedAdvanced && (
        <div className="pt-2.5 mt-1 border-t border-border/60 flex flex-wrap items-center gap-2.5 animate-in fade-in-50 duration-150">
          {/* Setor */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Setor:
            </span>
            <Select value={filterSetor} onValueChange={onSetorChange}>
              <SelectTrigger className="w-36 h-8 text-xs rounded-md bg-background border-border/80">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">
                  Todos os setores
                </SelectItem>
                {config.setores.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria (Novos Negócios) */}
          {config.tipo === "novos_negocios" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Subcategoria:
              </span>
              <Select
                value={filterSubcategoria}
                onValueChange={onSubcategoriaChange}
              >
                <SelectTrigger className="w-38 h-8 text-xs rounded-md bg-background border-border/80">
                  <SelectValue placeholder="Subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-medium">
                    Todas as subcategorias
                  </SelectItem>
                  {SUBCATEGORIAS.map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Status:
            </span>
            <Select value={filterStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="w-36 h-8 text-xs rounded-md bg-background border-border/80">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">
                  Todos os status
                </SelectItem>
                {STATUS_POR_TIPO[config.tipo].map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">
                    {STATUS_LABEL[v] ?? v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Faixa de Valor */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Valor (R$):
            </span>
            <div className="flex items-center gap-1">
              <Input
                placeholder="Mínimo"
                value={filterMinVal}
                onChange={(e) => onMinValChange(e.target.value)}
                className="w-24 h-8 text-xs rounded-md bg-background border-border/80"
                type="number"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                placeholder="Máximo"
                value={filterMaxVal}
                onChange={(e) => onMaxValChange(e.target.value)}
                className="w-24 h-8 text-xs rounded-md bg-background border-border/80"
                type="number"
              />
            </div>
          </div>

          {/* Toggle de Kanban Apenas com Projetos */}
          {viewMode === "kanban" && onKanbanApenasComProjetosChange && (
            <div className="ml-auto flex items-center gap-2 pl-3 border-l border-border/60">
              <Checkbox
                id="kanban-apenas-com-projetos"
                checked={kanbanApenasComProjetos}
                onCheckedChange={(checked) =>
                  onKanbanApenasComProjetosChange(checked === true)
                }
                className="rounded cursor-pointer"
              />
              <label
                htmlFor="kanban-apenas-com-projetos"
                className="text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground"
              >
                Apenas estágios com projetos
              </label>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
