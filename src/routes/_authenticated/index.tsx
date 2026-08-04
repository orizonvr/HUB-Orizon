import { createFileRoute } from "@tanstack/react-router";
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
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  return { day: String(d.getDate()).padStart(2, "0"), month };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days} d`;
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

  const kpiCards: Array<{ label: string; value: string; hint: string; icon: LucideIcon }> = [
    {
      label: "Iniciativas ativas",
      value: data ? String(data.kpis.transacoesAtivas) : "—",
      hint: tipo === "tudo" ? "M&A + Novos Negócios" : tipo === "ma" ? "Somente M&A" : "Somente Novos Negócios",
      icon: Briefcase,
    },
    {
      label: "Pipeline agregado",
      value: data ? formatCurrencyShort(data.kpis.pipelineAgregado) : "—",
      hint:
        tipo === "novos_negocios"
          ? "CAPEX Total Projeto (ativos)"
          : "Valor potencial total",
      icon: TrendingUp,
    },
    ...(tipo === "novos_negocios"
      ? [{
          label: "Receita Líquida Total",
          value: data ? formatCurrencyShort(data.kpis.receitaLiquidaNnTotal) : "—",
          hint: "Soma dos projetos ativos",
          icon: TrendingUp,
        }, {
          label: "EBITDA Total",
          value: data ? formatCurrencyShort(data.kpis.ebitdaNnTotal) : "—",
          hint: "Soma dos projetos ativos",
          icon: Gauge,
        }]
      : []),
    ...((tipo === "tudo" || tipo === "ma")
      ? [{
          label: "Volume pipeline M&A",
          value: data ? formatTonDiaShort(data.kpis.volumeMaTotal) : "—",
          hint: "Soma de capacidade operacional",
          icon: Gauge,
        }, {
          label: "EBITDA 2025 do Pipeline",
          value: data ? formatEbitdaMM(data.kpis.ebitda2025MaTotal) : "—",
          hint: "Soma de EBITDA histórico (M&A)",
          icon: TrendingUp,
        }]
      : []),
    {
      label: "Em due diligence",
      value: data ? String(data.kpis.emDueDiligence) : "—",
      hint: "DD / Aprovação comitê",
      icon: ClipboardCheck,
    },
    {
      label: "Closings no trimestre",
      value: data ? String(data.kpis.closingsTrimestre) : "—",
      hint: "Previstos no trimestre",
      icon: CalendarClock,
    },
  ];

  const maxStage = Math.max(1, ...(data?.pipeline.map((p) => p.value) ?? [1]));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {formatToday()}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            {greeting()}{firstName ? `, ${firstName}.` : "."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Panorama consolidado das iniciativas da equipe.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={tipo}
            onValueChange={(v) => v && setTipo(v as TipoFiltro)}
            className="rounded-md border border-border bg-background p-0.5"
          >
            <ToggleGroupItem value="tudo" className="h-8 px-3 text-xs">Tudo</ToggleGroupItem>
            <ToggleGroupItem value="ma" className="h-8 px-3 text-xs">M&A</ToggleGroupItem>
            <ToggleGroupItem value="novos_negocios" className="h-8 px-3 text-xs">Novos Negócios</ToggleGroupItem>
          </ToggleGroup>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <CircleDot className="h-3 w-3 text-success" /> Dados ao vivo
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <Card
            key={k.label}
            className="group relative overflow-hidden border-border/80 bg-card p-5 shadow-none transition-colors hover:border-primary/30"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {k.label}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              {isLoading ? <Skeleton className="h-8 w-20" /> : k.value}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{k.hint}</div>
          </Card>
        ))}
      </div>

      {/* Reunião de Pipeline — destaque para admin/líder */}
      {isAdminLider && (
        <Card className="mt-6 border-border/80 bg-accent/40 p-5 shadow-none">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Reunião de Pipeline
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Registre decisões e crie tarefas para o time
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowReuniao(true)}
              className="shrink-0 sm:self-center"
            >
              Iniciar reunião
            </Button>
          </div>
        </Card>
      )}

      {/* Tarefas */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MinhasTarefasBlock />
        <TarefasDoTimeBlock />
      </div>

      {/* Pipeline + Próximas ações */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 border-border/80 p-6 shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Pipeline por estágio</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tipo === "tudo" ? "Consolidado — M&A + Novos Negócios" : tipo === "ma" ? "Pipeline M&A" : "Pipeline Novos Negócios"}
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full bg-accent text-accent-foreground">
              {data ? data.totalProjetos : 0} projetos
            </Badge>
          </div>
          <div className="mt-6 h-[280px] w-full">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pipeline} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }} barCategoryGap={14}>
                  <XAxis type="number" hide domain={[0, maxStage + 1]} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    axisLine={false}
                    tickLine={false}
                    width={150}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(value: number, _n, props) => [
                      `${value} projeto(s) · ${formatCurrencyShort(props.payload.amount)}`,
                      "Pipeline",
                    ]}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {data.pipeline.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === data.pipeline.length - 1 ? "var(--gold)" : "var(--primary)"}
                        fillOpacity={0.85 - i * 0.08}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 border-border/80 p-6 shadow-none">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Próximas ações</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Marcos com fechamento mais próximo</p>
          </div>
          {!data || data.upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nenhum marco com data de fechamento futura.</p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {data.upcoming.map((a) => {
                const chip = formatDateChip(a.date);
                return (
                  <li key={a.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-secondary/50 px-2 py-1.5 text-center">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{chip.month}</span>
                      <span className="mt-0.5 text-sm font-semibold leading-none text-foreground">{chip.day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.project}</p>
                    </div>
                    <span className="hidden self-center text-xs text-muted-foreground sm:inline">{a.owner}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Evolução + Top 5 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 border-border/80 p-6 shadow-none">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Evolução do pipeline</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Projetos ativos por mês — últimos 6 meses</p>
          </div>
          <div className="mt-6 h-[240px] w-full">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.evolucao} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 border-border/80 p-6 shadow-none">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Top 5 por valor</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Maiores projetos ativos</p>
          </div>
          {!data || data.top5.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {data.top5.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="w-5 text-xs font-medium text-muted-foreground">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.nome}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.tipo === "ma" ? "M&A" : "Novos Negócios"} · {t.estagio}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {formatCurrencyShort(t.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Novos Negócios por Subcategoria */}
      {(tipo === "tudo" || tipo === "novos_negocios") && (
        <div className="mt-6">
          <Card className="border-border/80 p-6 shadow-none">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Novos Negócios por Subcategoria
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Contagem e investimento total por subcategoria
                </p>
              </div>
              {data && data.subcategorias.length > 0 && (
                <Badge variant="secondary" className="rounded-full bg-accent text-accent-foreground">
                  {data.subcategorias.reduce((s, x) => s + x.count, 0)} projetos
                </Badge>
              )}
            </div>
            {!data || data.subcategorias.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Nenhum projeto de Novos Negócios com subcategoria definida.
              </p>
            ) : (
              <div className="mt-6 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.subcategorias}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                    barCategoryGap={12}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      width={140}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(value: number, _n, props) => [
                        `${value} projeto(s) · ${formatCurrencyShort(props.payload.amount)}`,
                        "Subcategoria",
                      ]}
                      labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--primary)" fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Alertas + Atualizações */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2 border-border/80 p-6 shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Alertas</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Projetos que precisam de atenção</p>
            </div>
            {data && data.alertas.length > 0 && (
              <Badge variant="secondary" className="rounded-full bg-destructive/10 text-destructive">
                {data.alertas.length}
              </Badge>
            )}
          </div>
          {!data || data.alertas.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sem alertas. 🎉</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.alertas.map((al) => (
                <li key={al.id} className="flex gap-3 rounded-md border border-border bg-secondary/40 p-3">
                  <AlertTriangle
                    className={
                      "mt-0.5 h-4 w-4 shrink-0 " +
                      (al.nivel === "alto" ? "text-destructive" : "text-gold")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{al.projeto}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{al.motivo}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3 border-border/80 p-6 shadow-none">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Atualizações recentes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Feed da equipe — últimas movimentações</p>
          </div>
          <Separator className="my-5" />
          {!data || data.feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
          ) : (
            <ol className="relative space-y-6 pl-5">
              <span aria-hidden className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              {data.feed.map((u) => {
                const { verb, detail, tone } = activityDescribe(u);
                return (
                  <li key={u.id} className="relative">
                    <span
                      aria-hidden
                      className={
                        "absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background " +
                        (tone === "gold"
                          ? "bg-gold"
                          : tone === "success"
                          ? "bg-success"
                          : tone === "muted"
                          ? "bg-muted-foreground/60"
                          : "bg-primary")
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{u.actor}</span>{" "}
                        <span className="text-muted-foreground">{verb}</span>{" "}
                        <span className="font-medium">{u.projeto}</span>
                      </p>
                      <p className="text-xs text-muted-foreground" title={formatAbsolute(u.when)}>
                        {detail ? `${detail} · ` : ""}
                        {formatRelative(u.when)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
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
