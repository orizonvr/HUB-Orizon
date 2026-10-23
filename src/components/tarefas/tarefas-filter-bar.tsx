import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  ORIGEM_LABEL,
  type TarefaPrioridade,
  type TarefaStatus,
  type TarefaOrigem,
} from "@/lib/tarefas-types";
import { ViewModoToggle } from "@/components/tarefas/view-modo-toggle";
import type { ViewTarefasModo } from "@/lib/notificacoes-types";

export type PrazoFilter = "todos" | "vencidas" | "hoje" | "7d" | "30d";

const PRAZO_LABEL_MAP: Record<PrazoFilter, string> = {
  todos: "Todos os prazos",
  vencidas: "Vencidas",
  hoje: "Hoje",
  "7d": "Próximos 7 dias",
  "30d": "Próximos 30 dias",
};

const DEP_LABEL_MAP: Record<string, string> = {
  com_dep: "Com dependência",
  terceiros: "Terceiros",
  sem_dep: "Sem dependência",
};

interface TarefasFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  fTipo: string;
  onTipoChange: (v: string) => void;
  fStatus: string;
  onStatusChange: (v: string) => void;
  fPrazo: PrazoFilter;
  onPrazoChange: (v: PrazoFilter) => void;
  fClassificacao: string;
  onClassificacaoChange: (v: string) => void;
  fDep: string;
  onDepChange: (v: string) => void;
  fResp: string;
  onRespChange: (v: string) => void;
  fPrio: string;
  onPrioChange: (v: string) => void;
  fOrigem: string;
  onOrigemChange: (v: string) => void;
  escopo: "minhas" | "time" | "todas";
  profiles: Array<{ id: string; nome_completo: string }>;
  modo: ViewTarefasModo;
  onModoChange: (m: ViewTarefasModo) => void;
  totalNoEscopo: number;
  totalFiltered: number;
  onResetFilters: () => void;
}

export function TarefasFilterBar({
  search,
  onSearchChange,
  fTipo,
  onTipoChange,
  fStatus,
  onStatusChange,
  fPrazo,
  onPrazoChange,
  fClassificacao,
  onClassificacaoChange,
  fDep,
  onDepChange,
  fResp,
  onRespChange,
  fPrio,
  onPrioChange,
  fOrigem,
  onOrigemChange,
  escopo,
  profiles,
  modo,
  onModoChange,
  totalNoEscopo,
  totalFiltered,
  onResetFilters,
}: TarefasFilterBarProps) {
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);

  // Conta filtros avançados ativos
  const advancedCount =
    (fClassificacao !== "all" ? 1 : 0) +
    (fDep !== "all" ? 1 : 0) +
    (fPrio !== "all" ? 1 : 0) +
    (fOrigem !== "all" ? 1 : 0);

  // Verifica se há qualquer filtro ativo (incluindo primários)
  const hasActiveFilters =
    search.trim() !== "" ||
    (escopo !== "minhas" && fResp !== "all") ||
    fTipo !== "all" ||
    fStatus !== "ativas" ||
    fPrazo !== "todos" ||
    advancedCount > 0;

  const respProfile = profiles.find((p) => p.id === fResp);

  return (
    <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-3 space-y-2.5">
      {/* 1. LINHA PRIMÁRIA: BUSCA + FILTROS ESSENCIAIS + AÇÕES */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título ou projeto..."
              className="pl-8 h-9 rounded-lg bg-background border-border/80 focus-visible:ring-primary/25"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro: Responsável (Primeira Linha) */}
          {escopo !== "minhas" && (
            <Select value={fResp} onValueChange={onRespChange}>
              <SelectTrigger className="w-38 sm:w-42 h-9 rounded-lg bg-background border-border/80 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filtro: Pipeline */}
          <Select value={fTipo} onValueChange={onTipoChange}>
            <SelectTrigger className="w-34 h-9 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os pipelines</SelectItem>
              <SelectItem value="ma">M&A</SelectItem>
              <SelectItem value="novos_negocios">Novos Negócios</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro: Status */}
          <Select value={fStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-32 h-9 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ativas">Ativas</SelectItem>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro: Prazo */}
          <Select
            value={fPrazo}
            onValueChange={(v) => onPrazoChange(v as PrazoFilter)}
          >
            <SelectTrigger className="w-34 h-9 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Prazo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todos">Todos os prazos</SelectItem>
              <SelectItem value="vencidas">Vencidas</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Próximos 7 dias</SelectItem>
              <SelectItem value="30d">Próximos 30 dias</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão de Filtros Avançados */}
          <Button
            type="button"
            variant={expandedAdvanced || advancedCount > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setExpandedAdvanced(!expandedAdvanced)}
            className={cn(
              "h-9 px-3 gap-1.5 rounded-lg text-xs font-medium border-border/80 cursor-pointer transition-colors",
              advancedCount > 0 && "border-primary/50 text-primary font-semibold bg-primary/5",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Mais Filtros</span>
            {advancedCount > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1 font-bold">
                {advancedCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform duration-200",
                expandedAdvanced && "rotate-180",
              )}
            />
          </Button>
        </div>

        {/* Lado Direito: Alternador de Visualização (Tabela / Cards / Kanban) */}
        <div className="shrink-0 flex items-center gap-2">
          <ViewModoToggle value={modo} onChange={onModoChange} />
        </div>
      </div>

      {/* 2. LINHA EXPANSÍVEL: FILTROS ESPECÍFICOS & AVANÇADOS */}
      {expandedAdvanced && (
        <div className="pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-2 animate-in fade-in-50 duration-200">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Filtros Específicos:
          </span>

          {/* Filtro: Classificação */}
          <Select value={fClassificacao} onValueChange={onClassificacaoChange}>
            <SelectTrigger className="w-38 h-8 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas classificações</SelectItem>
              <SelectItem value="tarefa">Tarefas Padrão</SelectItem>
              <SelectItem value="acompanhamento">Acompanhamentos</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro: Dependência */}
          <Select value={fDep} onValueChange={onDepChange}>
            <SelectTrigger className="w-36 h-8 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Dependência" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas dependências</SelectItem>
              <SelectItem value="com_dep">Com dependência</SelectItem>
              <SelectItem value="terceiros">Terceiros</SelectItem>
              <SelectItem value="sem_dep">Sem dependência</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro: Prioridade */}
          <Select value={fPrio} onValueChange={onPrioChange}>
            <SelectTrigger className="w-32 h-8 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro: Origem */}
          <Select value={fOrigem} onValueChange={onOrigemChange}>
            <SelectTrigger className="w-36 h-8 rounded-lg bg-background border-border/80 text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas origens</SelectItem>
              {Object.entries(ORIGEM_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 3. FAIXA DE CHIPS DE FILTROS ATIVOS + CONTADOR */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">
              Filtros ativos:
            </span>

            {search.trim() && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Busca: "{search.trim()}"</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onSearchChange("")}
                />
              </Badge>
            )}

            {fTipo !== "all" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Pipeline: {fTipo === "ma" ? "M&A" : "Novos Negócios"}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onTipoChange("all")}
                />
              </Badge>
            )}

            {fStatus !== "ativas" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Status: {fStatus === "all" ? "Todos" : STATUS_LABEL[fStatus as TarefaStatus] ?? fStatus}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onStatusChange("ativas")}
                />
              </Badge>
            )}

            {fPrazo !== "todos" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Prazo: {PRAZO_LABEL_MAP[fPrazo]}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onPrazoChange("todos")}
                />
              </Badge>
            )}

            {fClassificacao !== "all" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>
                  {fClassificacao === "tarefa"
                    ? "Tarefas Padrão"
                    : "Acompanhamentos"}
                </span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onClassificacaoChange("all")}
                />
              </Badge>
            )}

            {fDep !== "all" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>{DEP_LABEL_MAP[fDep] ?? fDep}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onDepChange("all")}
                />
              </Badge>
            )}

            {fResp !== "all" && respProfile && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Resp: {respProfile.nome_completo}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onRespChange("all")}
                />
              </Badge>
            )}

            {fPrio !== "all" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Prio: {PRIORIDADE_LABEL[fPrio as TarefaPrioridade] ?? fPrio}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onPrioChange("all")}
                />
              </Badge>
            )}

            {fOrigem !== "all" && (
              <Badge
                variant="secondary"
                className="rounded-md py-0.5 px-2 text-[11px] font-medium gap-1 bg-secondary hover:bg-secondary/80 border border-border/70"
              >
                <span>Origem: {ORIGEM_LABEL[fOrigem as TarefaOrigem] ?? fOrigem}</span>
                <X
                  className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onOrigemChange("all")}
                />
              </Badge>
            )}

            {/* Botão Limpar Filtros */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold gap-1 rounded-md cursor-pointer ml-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar filtros</span>
            </Button>
          </div>

          {/* Contador de Resultados */}
          <div className="text-[11px] text-muted-foreground">
            Exibindo <span className="font-semibold text-foreground">{totalFiltered}</span> de{" "}
            <span className="font-semibold text-foreground">{totalNoEscopo}</span> tarefas
          </div>
        </div>
      )}
    </Card>
  );
}
