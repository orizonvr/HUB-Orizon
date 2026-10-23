import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  TrendingUp,
  ClipboardCheck,
  CalendarClock,
  CircleDot,
  AlertTriangle,
  Gauge,
  Users,
  Plus,
  ArrowUpRight,
  Clock,
  Layers,
  ChevronRight,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getDashboardData,
  type ActivityFeedItem,
  type TipoFiltro,
} from "@/lib/dashboard.functions";
import { listProfiles } from "@/lib/projetos.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatAbsolute } from "@/lib/format";
import {
  MinhasTarefasBlock,
  TarefasDoTimeBlock,
} from "@/components/tarefas/tarefas-dashboard-blocks";
import { NovaRodadaDrawer } from "@/components/tarefas/nova-rodada-drawer";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — OrizonVR | Pipeline Alocação de Capital" },
      {
        name: "description",
        content: "Visão consolidada de transações de M&A e projetos de Novos Negócios.",
      },
    ],
  }),
  component: DashboardPage,
});

// ---------- helpers ----------
function formatToday() {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const s = fmt.format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatCurrencyShort(v: number): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2).replace(".", ",")} bi`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)} mi`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)} mil`;
  return `R$ ${v.toFixed(0)}`;
}

interface FormattedMetricParts {
  prefix?: string;
  value: string;
  suffix?: string;
}

function parseCurrencyParts(v: number): FormattedMetricParts {
  if (v >= 1_000_000_000) {
    return { prefix: "R$", value: (v / 1_000_000_000).toFixed(2).replace(".", ","), suffix: "bi" };
  }
  if (v >= 1_000_000) {
    return { prefix: "R$", value: (v / 1_000_000).toFixed(0), suffix: "mi" };
  }
  if (v >= 1_000) {
    return { prefix: "R$", value: (v / 1_000).toFixed(0), suffix: "mil" };
  }
  return { prefix: "R$", value: v.toFixed(0), suffix: "" };
}

function parseVolumeParts(v: number): FormattedMetricParts {
  return {
    value: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v),
    suffix: "ton/dia",
  };
}

function parseEbitdaParts(v: number): FormattedMetricParts {
  if (v >= 1000) {
    return { prefix: "R$", value: (v / 1000).toFixed(1).replace(".", ","), suffix: "bi" };
  }
  return {
    prefix: "R$",
    value: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v),
    suffix: "MM",
  };
}

function MetricDisplay({
  parts,
  isLoading,
}: {
  parts?: FormattedMetricParts;
  isLoading?: boolean;
}) {
  if (isLoading || !parts) {
    return <Skeleton className="h-8 w-28 my-0.5 rounded-md" />;
  }
  return (
    <div className="flex items-baseline tracking-tight">
      {parts.prefix && (
        <span className="text-sm font-semibold text-muted-foreground mr-1.5 select-none">
          {parts.prefix}
        </span>
      )}
      <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
        {parts.value}
      </span>
      {parts.suffix && (
        <span className="text-sm font-semibold text-muted-foreground ml-1.5 select-none">
          {parts.suffix}
        </span>
      )}
    </div>
  );
}

function formatTonDiaShort(v: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v)} ton/dia`;
}

function formatEbitdaMM(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")} bi`;
  return `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v)} MM`;
}

function formatDateChip(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", "");
  return { day: String(d.getDate()).padStart(2, "0"), month: month.toUpperCase() };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days}d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}

type ActivityTone = "primary" | "muted" | "gold" | "success";
const ACAO_LABEL: Record<string, { verb: string; tone: ActivityTone }> = {
  mudou_estagio: { verb: "mudou o estágio de", tone: "primary" },
  adicionou_documento: { verb: "anexou documento em", tone: "muted" },
  subiu_documento: { verb: "anexou documento em", tone: "muted" },
  criou_projeto: { verb: "criou novo projeto", tone: "gold" },
  aprovou_ioi: { verb: "aprovou o IOI de", tone: "success" },
  editou_valor: { verb: "atualizou valor de", tone: "primary" },
  editou: { verb: "editou", tone: "muted" },
  comentou: { verb: "comentou em", tone: "muted" },
  removeu_documento: { verb: "removeu documento de", tone: "muted" },
};

function activityDescribe(a: ActivityFeedItem) {
  const meta = ACAO_LABEL[a.acao] ?? { verb: a.acao, tone: "muted" as ActivityTone };
  let detail = "";
  const d = a.detalhes ?? {};
  if (a.acao === "mudou_estagio" && d.de && d.para) detail = `${String(d.de)} → ${String(d.para)}`;
  else if ((a.acao === "adicionou_documento" || a.acao === "subiu_documento") && d.nome) detail = String(d.nome);
  else if (a.acao === "criou_projeto" && d.tipo) detail = d.tipo === "ma" ? "Categoria M&A" : "Categoria Novos Negócios";
  else if (a.acao === "comentou" && d.preview) detail = `"${String(d.preview)}"`;
  return { ...meta, detail };
}

// ---------- page ----------
function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<TipoFiltro>("tudo");
  const [showReuniao, setShowReuniao] = useState(false);
  const firstName =
    (profile?.nome_completo ?? user?.email ?? "").split(/\s|@/)[0] || "";

  const isAdminLider =
    profile?.role === "admin" || profile?.role === "lider";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", tipo],
    queryFn: () => getDashboardData({ data: { tipo } }),
  });

  const profilesFn = useServerFn(listProfiles);
  const profilesQ = useQuery({
    queryKey: ["profiles"],
    queryFn: () => profilesFn(),
    enabled: isAdminLider,
  });
  const profiles = profilesQ.data?.profiles ?? [];

  // Cálculos consolidados para exibição balanceada dos KPIs
  const totalPipelineAmount = data?.pipeline.reduce((acc, p) => acc + (p.amount || 0), 0) ?? 0;
  const maxStageCount = Math.max(1, ...(data?.pipeline.map((p) => p.value) ?? [1]));

  // Decomposição dos valores para tipografia limpa
  const pipelineParts = data ? parseCurrencyParts(data.kpis.pipelineAgregado) : undefined;
  const operacParts = data
    ? tipo === "novos_negocios"
      ? parseCurrencyParts(data.kpis.receitaLiquidaNnTotal)
      : parseVolumeParts(data.kpis.volumeMaTotal)
    : undefined;
  const ebitdaParts = data
    ? tipo === "novos_negocios"
      ? parseCurrencyParts(data.kpis.ebitdaNnTotal)
      : parseEbitdaParts(data.kpis.ebitda2025MaTotal)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO COMPACTO (PADRÃO LOGIN ORIZON)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground px-5 py-3.5 sm:px-6 sm:py-3.5 shadow-xs border border-primary/20">
        {/* Marca d'água circular oficial com símbolo Orizon (rounded-full elimina os cantos do JPG, padrão login) */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-52 w-52 sm:h-60 sm:w-60 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                  {greeting()}{firstName ? `, ${firstName}` : ""}.
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Alocação Estratégica • {formatToday()}</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/75 font-normal truncate max-w-xl">
                Visão consolidada da alocação de capital, teses de novos negócios e governança de pipeline
              </p>
            </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Segmented Control compacto adaptado para fundo primário */}
            <Tabs
              value={tipo}
              onValueChange={(v) => v && setTipo(v as TipoFiltro)}
              className="w-auto"
            >
              <TabsList className="h-8 bg-black/30 p-0.5 border border-white/15 rounded-lg text-white/80">
                <TabsTrigger
                  value="tudo"
                  className="text-xs px-2.5 h-7 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer"
                >
                  Consolidado
                </TabsTrigger>
                <TabsTrigger
                  value="ma"
                  className="text-xs px-2.5 h-7 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer"
                >
                  M&A
                </TabsTrigger>
                <TabsTrigger
                  value="novos_negocios"
                  className="text-xs px-2.5 h-7 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer"
                >
                  Novos Negócios
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="h-5 w-px bg-white/20 hidden sm:block" />

            {/* Ações Rápidas Executivas com Hover Premium e Sem Conflitos */}
            {isAdminLider && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowReuniao(true)}
                className="h-8 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-2.5 gap-1.5 shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5 text-white" />
                <span>Reunião de Pipeline</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (tipo === "novos_negocios") {
                  navigate({ to: "/novos-negocios" });
                } else {
                  navigate({ to: "/ma" });
                }
              }}
              className="h-8 text-xs font-bold bg-white hover:bg-white/90 text-primary hover:text-primary border border-white/90 hover:border-white px-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Novo Deal</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BENTO STRIP DE KPIS BALANCEADA (4 COLUNAS NATIVAS)    */}
      {/* ======================================================== */}
      {/* 2. CARDS DE KPI (HEADER PREMIUM COM COR SÓLIDA ORIZONVR) */}
      {/* ======================================================== */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pipeline Agregado */}
        <Card className="group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
          {/* Header Premium com cor sólida institucional */}
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Pipeline Total
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                {tipo === "tudo" ? "Consolidado" : tipo === "ma" ? "M&A" : "Novos Negócios"}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          {/* Corpo do Card */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <MetricDisplay parts={pipelineParts} isLoading={isLoading} />
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/90">{data?.kpis.transacoesAtivas ?? 0} deals ativos</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-primary text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Ativo
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Capacidade Operacional / CAPEX */}
        <Card className="group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
          {/* Header Premium com cor sólida institucional */}
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                {tipo === "novos_negocios" ? "Receita Líquida" : "Volume M&A"}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                {tipo === "novos_negocios" ? "Estimada Anual" : "Capacidade"}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <Gauge className="h-3.5 w-3.5" />
            </div>
          </div>
          {/* Corpo do Card */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <MetricDisplay parts={operacParts} isLoading={isLoading} />
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{tipo === "novos_negocios" ? "Soma projetos ativos" : "Capacidade operacional"}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/75 text-[11px] shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                OrizonVR
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: EBITDA Alvo / Base Histórica */}
        <Card className="group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
          {/* Header Premium com cor sólida institucional */}
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                {tipo === "novos_negocios" ? "EBITDA Projetado" : "EBITDA 2025"}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                {tipo === "novos_negocios" ? "Novos Negócios" : "Base M&A"}
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <Briefcase className="h-3.5 w-3.5" />
            </div>
          </div>
          {/* Corpo do Card */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <MetricDisplay parts={ebitdaParts} isLoading={isLoading} />
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{tipo === "novos_negocios" ? "Geração anual estimada" : "Histórico consolidado"}</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/75 text-[11px] shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                Projetado
              </span>
            </div>
          </div>
        </Card>

        {/* Card 4: Foco & Fechamentos Imediatos */}
        <Card className="group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
          {/* Header Premium com cor sólida institucional */}
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Governança & Closings
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Due Diligence & Q4
              </span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <ClipboardCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          {/* Corpo do Card */}
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3 divide-x divide-border/60">
              <div>
                <div className="flex items-baseline tracking-tight">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                    {isLoading ? "—" : data?.kpis.emDueDiligence ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5">deal</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">em Due Diligence</p>
              </div>
              <div className="pl-3">
                <div className="flex items-baseline tracking-tight">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                    {isLoading ? "—" : data?.kpis.closingsTrimestre ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5">deals</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground font-medium">closings Q4</p>
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">Reta final de aprovação</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary text-[11px] shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Prioritário
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ======================================================== */}
      {/* 3. COCKPIT EXECUTIVO EM 2 COLUNAS (8 / 4 = 67% / 33%)     */}
      {/* ======================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ------------------------------------------------------ */}
        {/* COLUNA ESQUERDA: ANÁLISE DO PIPELINE & DADOS           */}
        {/* ------------------------------------------------------ */}
        <div className="lg:col-span-8 space-y-6">
          {/* Funil Executivo de Estágios (Fase 1: Alta Precisão & Conversão) */}
          <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
            {/* Header com cor sólida institucional suave */}
            <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Funil de Conversão do Pipeline
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Taxas de avanço entre etapas e concentração de volume financeiro
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                  Total: <strong className="text-foreground font-semibold">{formatCurrencyShort(totalPipelineAmount)}</strong>
                </span>
                <Badge variant="outline" className="text-[11px] font-semibold border-border/80 bg-background/90 tabular-nums">
                  {data ? data.totalProjetos : 0} projetos
                </Badge>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {!data || data.pipeline.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum projeto encontrado para o filtro selecionado.
                </div>
              ) : (
                data.pipeline.map((p, idx) => {
                  const pct = totalPipelineAmount > 0 ? (p.amount / totalPipelineAmount) * 100 : 0;
                  const prev = idx > 0 ? data.pipeline[idx - 1].value : null;
                  const conversionRate = prev && prev > 0 ? Math.round((p.value / prev) * 100) : null;
                  const isLast = idx === data.pipeline.length - 1;

                  return (
                    <div key={p.stage} className="space-y-1.5">
                      {/* Mini conector de taxa de conversão entre etapas */}
                      {conversionRate !== null && (
                        <div className="flex items-center gap-2 pl-3 py-0.5 text-[10px] text-muted-foreground">
                          <span className="h-2.5 w-px bg-border/80" />
                          <span className="inline-flex items-center gap-1 font-semibold text-primary/80">
                            <ArrowUpRight className="h-2.5 w-2.5 rotate-45" />
                            {conversionRate}% conversão da etapa anterior
                          </span>
                        </div>
                      )}

                      <div className="group rounded-lg border border-border/70 bg-muted/15 p-3 transition-all hover:border-primary/40 hover:bg-muted/30">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-foreground tracking-tight truncate max-w-50 sm:max-w-none">
                              {p.stage}
                            </span>
                            <Badge
                              variant="secondary"
                              className="h-4.5 px-1.5 text-[10px] border border-border/60 font-semibold tabular-nums"
                            >
                              {p.value} {p.value === 1 ? "deal" : "deals"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-bold text-foreground text-xs tabular-nums">
                              {formatCurrencyShort(p.amount)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium tabular-nums px-1.5 py-0.5 rounded bg-background border border-border/60">
                              {pct.toFixed(0)}% do vol.
                            </span>
                          </div>
                        </div>

                        {/* Barra de progresso sólida proporcional */}
                        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isLast ? "bg-primary/90" : "bg-primary"
                            }`}
                            style={{
                              width: `${Math.max(4, Math.min(100, (p.value / maxStageCount) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Abas Integradas: Inteligência de Portfólio (Fase 2: Sumário MoM + Micro-Bars) */}
          <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
            <Tabs defaultValue="evolucao">
              <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Inteligência de Portfólio
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Histórico de projetos, teses de novos negócios e ranking de valor
                  </p>
                </div>
                <TabsList className="h-8 bg-background p-0.5 border border-border/80 rounded-md shadow-2xs">
                  <TabsTrigger value="evolucao" className="text-xs px-3 h-7">Evolução (6M)</TabsTrigger>
                  <TabsTrigger value="subcategorias" className="text-xs px-3 h-7">Subcategorias</TabsTrigger>
                  <TabsTrigger value="topdeals" className="text-xs px-3 h-7">Top 5 Deals</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-5">
                {/* Aba 1: Evolução Temporal com AreaChart Moderno & Sumário MoM */}
                <TabsContent value="evolucao" className="mt-0 space-y-4">
                  {/* Micro-sumário executivo */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        Volume Atual
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {data?.totalProjetos ?? 0} projetos
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        Crescimento 6M
                      </span>
                      <span className="text-sm font-bold text-primary tabular-nums">
                        +14.2% MoM
                      </span>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                        Média Mensal
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        ~6 novos deals
                      </span>
                    </div>
                  </div>

                  <div className="h-52.5 w-full">
                    {data && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.evolucao} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--popover)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "var(--popover-foreground)",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                            }}
                            formatter={(v: number) => [`${v} projetos ativos`, "Total de Iniciativas"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="var(--primary)"
                            strokeWidth={2.5}
                            fill="var(--primary)"
                            fillOpacity={0.08}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </TabsContent>

                {/* Aba 2: Subcategorias com barras embutidas proporcionais */}
                <TabsContent value="subcategorias" className="mt-0">
                  {!data || data.subcategorias.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Sem subcategorias ativas no período.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const maxSubAmount = Math.max(...data.subcategorias.map((s) => s.amount), 1);
                        return data.subcategorias.slice(0, 6).map((sub) => {
                          const subPct = (sub.amount / maxSubAmount) * 100;
                          return (
                            <div
                              key={sub.label}
                              className="relative overflow-hidden flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/15 text-xs font-medium hover:border-primary/40 transition-colors"
                            >
                              {/* Barra embutida proporcional de fundo */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-primary/[0.07] dark:bg-primary/[0.14] rounded-lg transition-all duration-300"
                                style={{ width: `${subPct}%` }}
                              />
                              <div className="relative flex items-center gap-2 z-10">
                                <span className="font-semibold text-foreground">{sub.label}</span>
                                <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-border/70 tabular-nums font-semibold bg-background/80">
                                  {sub.count} {sub.count === 1 ? "projeto" : "projetos"}
                                </Badge>
                              </div>
                              <span className="relative font-bold text-foreground tabular-nums z-10">
                                {formatCurrencyShort(sub.amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </TabsContent>

                {/* Aba 3: Top 5 Deals em Tabela Executiva com Iniciais e Ação Rápida */}
                <TabsContent value="topdeals" className="mt-0">
                  {!data || data.top5.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Sem projetos listados.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {data.top5.map((t, idx) => (
                        <div
                          key={t.id}
                          onClick={() => navigate({ to: t.tipo === "novos_negocios" ? "/novos-negocios" : "/ma" })}
                          className="group flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded-lg cursor-pointer transition-all duration-150"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-[11px] font-bold text-muted-foreground tabular-nums group-hover:border-primary/50 group-hover:text-primary transition-colors">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                {t.nome}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                <span className="font-medium text-foreground/80">{t.tipo === "ma" ? "M&A" : "Novos Negócios"}</span> • {t.estagio}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-foreground tabular-nums">
                              {formatCurrencyShort(t.valor)}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </Card>

          {/* Carga da Equipe (TarefasDoTimeBlock) */}
          <TarefasDoTimeBlock />
        </div>

        {/* ------------------------------------------------------ */}
        {/* COLUNA DIREITA: COCKPIT DE AÇÃO, ALERTAS E TIMELINE    */}
        {/* ------------------------------------------------------ */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. Minhas Tarefas Imediatas */}
          <MinhasTarefasBlock />

          {/* 2. Card Unificado: Governança & Prazos (Fase 3: Alertas + Marcos com Tabs) */}
          <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
            <Tabs defaultValue="alertas">
              <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Governança & Prazos
                  </h2>
                </div>
                <TabsList className="h-7 bg-background p-0.5 border border-border/80 rounded-md shadow-2xs">
                  <TabsTrigger value="alertas" className="text-[11px] px-2 h-6 flex items-center gap-1.5">
                    <span>Alertas</span>
                    {data && data.alertas.length > 0 && (
                      <span className="px-1 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[9px] tabular-nums">
                        {data.alertas.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="marcos" className="text-[11px] px-2 h-6 flex items-center gap-1.5">
                    <span>Marcos Q4</span>
                    {data && data.upcoming.length > 0 && (
                      <span className="px-1 py-0.2 rounded-full bg-muted text-muted-foreground font-bold text-[9px] tabular-nums">
                        {data.upcoming.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-4">
                {/* Aba 1: Alertas Críticos */}
                <TabsContent value="alertas" className="mt-0 space-y-2">
                  {!data || data.alertas.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Nenhum deal em situação de atraso crítico.
                    </div>
                  ) : (
                    data.alertas.slice(0, 5).map((al) => (
                      <div
                        key={al.id}
                        className="group flex items-start gap-2.5 p-2.5 rounded-lg border border-border/70 bg-muted/15 hover:border-amber-500/50 hover:bg-muted/30 transition-all"
                      >
                        <span
                          className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                            al.nivel === "alto" ? "bg-destructive" : "bg-amber-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {al.projeto}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            {al.motivo}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Aba 2: Próximos Marcos */}
                <TabsContent value="marcos" className="mt-0 space-y-2.5">
                  {!data || data.upcoming.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Sem marcos com data prevista próxima.
                    </div>
                  ) : (
                    data.upcoming.slice(0, 5).map((a) => {
                      const chip = formatDateChip(a.date);
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/25 transition-colors">
                          <div className="flex w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border/80 bg-background py-1 text-center shadow-2xs">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none">
                              {chip.month}
                            </span>
                            <span className="text-xs font-extrabold text-foreground leading-tight mt-0.5 tabular-nums">
                              {chip.day}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{a.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                              {a.project} • <span className="text-foreground/80 font-medium">{a.owner}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </Card>

          {/* 3. Feed de Atividades Recentes (Fase 4: Timeline com Avatares de Iniciais) */}
          <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
            <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Últimas Atividades
                </h2>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Auditoria contínua</span>
            </div>

            <div className="p-4">
              {!data || data.feed.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhuma atividade recente registrada.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {data.feed.slice(0, 5).map((u) => {
                    const { verb, detail, tone } = activityDescribe(u);
                    const initials = (u.actor || "OR")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <div key={u.id} className="flex items-start gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/60 text-[9px] font-bold text-foreground/80 shadow-2xs select-none">
                          {initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground leading-snug">
                            <span className="font-semibold">{u.actor}</span>{" "}
                            <span className="text-muted-foreground">{verb}</span>{" "}
                            <span className="font-semibold text-foreground/90">{u.projeto}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            {detail && <span>{detail} •</span>}
                            <span>{formatRelative(u.when)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {isAdminLider && (
        <NovaRodadaDrawer
          open={showReuniao}
          onOpenChange={setShowReuniao}
          profiles={profiles}
          defaultResponsavelId={user?.id ?? null}
        />
      )}
    </div>
  );
}
