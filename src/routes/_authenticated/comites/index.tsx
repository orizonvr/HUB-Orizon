import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Gavel,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter as FilterIcon,
  RotateCcw,
  Users,
  Briefcase,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { listComites, type ComiteStatus } from "@/lib/comites.functions";
import { listProfiles } from "@/lib/projetos.functions";
import { NovoComiteDialog } from "@/components/comites/novo-comite-dialog";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comites/")({
  head: () => ({
    meta: [
      { title: "Comitês Executivos — OrizonVR | Pipeline" },
      {
        name: "description",
        content: "Decisões formais, alçadas e governança do pipeline de M&A e Novos Negócios.",
      },
    ],
  }),
  component: ComitesListPage,
});

const STATUS_META: Record<
  ComiteStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  preparacao: {
    label: "Em preparação",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    dotClass: "bg-amber-500",
  },
  realizado: {
    label: "Realizado",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
};

function formatDataBR(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia.replace(".", "")} às ${hora}`;
}

type FilterStatus = "todos" | "preparacao" | "realizado" | "cancelado";

function ComitesListPage() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("todos");

  const listFn = useServerFn(listComites);
  const profilesFn = useServerFn(listProfiles);

  const comitesQ = useQuery({
    queryKey: ["comites"],
    queryFn: () => listFn(),
  });
  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: () => profilesFn(),
  });

  const profMap = useMemo(
    () =>
      new Map(
        (profilesQ.data?.profiles ?? []).map((p) => [
          p.id,
          { id: p.id, nome: p.nome_completo, avatar_url: p.avatar_url },
        ]),
      ),
    [profilesQ.data],
  );

  const canCreate = profile?.role && profile.role !== "observador";
  const comites = comitesQ.data?.comites ?? [];

  // Cálculos consolidados para a Faixa de KPIs (Bento Strip)
  const totalComites = comites.length;
  const totalPreparacao = comites.filter((c) => c.status === "preparacao").length;
  const totalRealizados = comites.filter((c) => c.status === "realizado").length;
  const totalPautas = comites.reduce((acc, c) => acc + (c.pauta_count || 0), 0);

  // Filtragem composta
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return comites.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (q) {
        const text = `${c.titulo} ${c.criado_por_nome ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [comites, statusFilter, search]);

  const hasActiveFilters = statusFilter !== "todos" || search.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground px-5 py-4 sm:px-6 sm:py-4.5 shadow-xs border border-primary/20">
        {/* Marca d'água circular oficial da Orizon */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-52 w-52 sm:h-60 sm:w-60 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Identidade Institucional & Resumo */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Gavel className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Comitês & Governança
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Alçadas Decisórias</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 font-normal truncate max-w-2xl">
                Decisões formais, atas e direcionamento estratégico para o pipeline de M&amp;A e Novos Negócios
              </p>
            </div>
          </div>

          {/* Ações Rápidas Executivas */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canCreate && (
              <Button
                onClick={() => setOpen(true)}
                className="h-9 text-xs font-bold bg-white text-primary hover:bg-white/90 px-4 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span>Novo Comitê</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BENTO STRIP DE KPIS (PADRÃO TAREFAS / DASHBOARD)      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Comitês em Pauta / Preparação */}
        <Card
          onClick={() => setStatusFilter((prev) => (prev === "preparacao" ? "todos" : "preparacao"))}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            statusFilter === "preparacao" && "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/3",
          )}
        >
          <div className="bg-amber-500/[0.07] dark:bg-amber-500/[0.14] border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Em Preparação
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Em Pauta
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-amber-500/25 bg-background text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-200 shadow-2xs">
              <Clock className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {comitesQ.isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalPreparacao}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    sessões
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Pautas abertas para reunião
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {statusFilter === "preparacao" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Comitês Realizados */}
        <Card
          onClick={() => setStatusFilter((prev) => (prev === "realizado" ? "todos" : "realizado"))}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            statusFilter === "realizado" && "ring-2 ring-emerald-500/80 border-emerald-500 bg-emerald-500/3",
          )}
        >
          <div className="bg-emerald-500/[0.07] dark:bg-emerald-500/[0.14] border-b border-emerald-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Realizados
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Atas Emitidas
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-emerald-500/25 bg-background text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all duration-200 shadow-2xs">
              <CheckCircle2 className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {comitesQ.isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalRealizados}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    concluídos
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Decisões e deliberações salvas
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {statusFilter === "realizado" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: Projetos Deliberados / Em Pauta */}
        <Card
          onClick={() => {
            setStatusFilter("todos");
            setSearch("");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            statusFilter === "todos" && !hasActiveFilters && "ring-2 ring-primary/80 border-primary bg-primary/2",
          )}
        >
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Volume de Pautas
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Pipeline
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <Briefcase className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {comitesQ.isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalPautas}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    projetos analisados
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                M&amp;A e Novos Negócios
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {statusFilter === "todos" && !hasActiveFilters ? "Ativo" : "Ver Todos"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 4: Histórico Geral */}
        <Card
          onClick={() => {
            setStatusFilter("todos");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-sky-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            statusFilter === "todos" && "border-sky-500/30",
          )}
        >
          <div className="bg-sky-500/[0.07] dark:bg-sky-500/[0.14] border-b border-sky-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Total de Sessões
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Governança
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-sky-500/25 bg-background text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500 transition-all duration-200 shadow-2xs">
              <FileText className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {comitesQ.isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalComites}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    registrados
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Rastreabilidade institucional
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 dark:text-sky-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                Detalhes
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ======================================================== */}
      {/* 3. COCKPIT DE FILTROS & BUSCA UNIFICADA                 */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border/80">
        {/* Segmented Tabs de Status */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-muted/50 rounded-lg border border-border/60">
          {(
            [
              { key: "todos", label: "Todos", count: totalComites },
              { key: "preparacao", label: "Em preparação", count: totalPreparacao },
              { key: "realizado", label: "Realizados", count: totalRealizados },
              { key: "cancelado", label: "Cancelados", count: comites.filter((c) => c.status === "cancelado").length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                statusFilter === tab.key
                  ? "bg-background text-foreground shadow-2xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  statusFilter === tab.key
                    ? "bg-primary/10 text-primary font-bold"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Campo de Busca & Limpar Filtros */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou relator..."
              className="h-9 pl-8.5 pr-3 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-primary/20"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 rounded-lg"
              title="Limpar filtros"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. LISTA DE COMITÊS EXECUTIVOS                            */}
      {/* ======================================================== */}
      {comitesQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center rounded-xl border border-border/80">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/50 text-muted-foreground">
            <Gavel className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {hasActiveFilters ? "Nenhum comitê encontrado para este filtro" : "Nenhum comitê cadastrado ainda"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasActiveFilters
                ? "Tente ajustar a busca ou alterar a aba de status."
                : "Inicie um novo comitê formal para pautar decisões executivas."}
            </p>
          </div>
          {canCreate && !hasActiveFilters && (
            <Button size="sm" onClick={() => setOpen(true)} className="mt-2 rounded-xl text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Novo Comitê
            </Button>
          )}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
              }}
              className="mt-2 rounded-xl text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Redefinir Filtros
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((c) => {
            const meta = STATUS_META[c.status];
            const participantes = c.participante_ids
              .map((id) => profMap.get(id))
              .filter(Boolean) as Array<{
              id: string;
              nome: string;
              avatar_url: string | null;
            }>;

            return (
              <Link
                key={c.id}
                to="/comites/$id"
                params={{ id: c.id }}
                className="block group"
              >
                <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Lado Esquerdo: Identificador, Título e Metadados */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Gavel className="h-4 w-4" />
                        </div>
                        <h3 className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                          {c.titulo}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", meta.badgeClass)}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", meta.dotClass)} />
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDataBR(c.data)}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                          <Briefcase className="h-3.5 w-3.5" />
                          {c.pauta_count} {c.pauta_count === 1 ? "projeto na pauta" : "projetos na pauta"}
                        </span>
                        {c.criado_por_nome && (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              Criado por <strong className="text-foreground/80 font-medium">{c.criado_por_nome}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Lado Direito: Participantes e Indicador de Acesso */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 sm:text-right text-left">
                          Participantes ({participantes.length})
                        </p>
                        <AvatarStack items={participantes} max={5} size="sm" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 shadow-2xs">
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Novo Comitê */}
      <NovoComiteDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

