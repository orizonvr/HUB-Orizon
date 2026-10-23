import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Download,
  Plus,
  Briefcase,
  Sparkles,
  Calendar,
  DollarSign,
  FileText,
  ListTodo,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getProjetoDetail } from "@/lib/projetos.functions";
import { listTarefasByProjeto } from "@/lib/tarefas.functions";
import { PRIORIDADE_LABEL } from "@/lib/tarefas-types";
import {
  getDecisoesComiteByProjeto,
  type DecisaoComite,
} from "@/lib/comites.functions";
import { profilesQuery } from "@/components/projetos/projetos-workspace";
import { MA_CONFIG, NN_CONFIG, formatExtra, type ProjetoConfig } from "@/lib/projetos-config";
import {
  formatBRLFull,
  healthFor,
  HEALTH_BG,
  HEALTH_LABEL,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  formatAbsolute,
  formatPercentOrizon,
  formatTonDia,
  formatValorTransacaoMM,
} from "@/lib/format";
import { SUBCATEGORIA_LABEL, type Projeto, type Profile } from "@/lib/projetos-types";
import type { TarefaComContexto } from "@/lib/tarefas-types";
import { NovaTarefaDialog } from "@/components/tarefas/nova-tarefa-dialog";
import { useTarefaDrawer } from "@/hooks/use-tarefa-drawer";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  head: () => ({ meta: [{ title: "Dossiê do projeto — OrizonVR" }] }),
  component: DossiePage,
});

const DASH = "—";

function display(v: string | number | null | undefined): string {
  if (v == null) return DASH;
  const s = String(v).trim();
  return s === "" ? DASH : s;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type DecisaoKey =
  | "pendente"
  | "aprovado"
  | "aprovado_com_ressalvas"
  | "reprovado"
  | "adiado";

const DECISAO_LABEL: Record<DecisaoKey, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  aprovado_com_ressalvas: "Aprovado com ressalvas",
  reprovado: "Reprovado",
  adiado: "Adiado",
};

function decisaoBadgeClass(d: DecisaoKey): string {
  switch (d) {
    case "aprovado":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "aprovado_com_ressalvas":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "reprovado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "adiado":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function financeiroRows(
  p: Projeto,
  variant: "ma" | "nn",
): Array<{ label: string; value: string }> {
  if (variant === "ma") {
    return [
      { label: "Valor da transação", value: formatValorTransacaoMM(p.valor_transacao_mm) ?? DASH },
      { label: "Valor estimado", value: formatBRLFull(p.valor_estimado) },
      { label: "EBITDA 2025", value: formatBRLFull(p.ebitda_2025) },
      { label: "EBITDA alvo", value: formatBRLFull(p.ebitda_alvo) },
      { label: "Múltiplo EV/EBITDA", value: formatExtra(p.multiplo_ev_ebitda, "multiple") },
      { label: "Sinergias estimadas", value: formatBRLFull(p.sinergias_estimadas) },
      { label: "Volume", value: formatTonDia(p.volume_ton_dia) ?? DASH },
    ];
  }
  return [
    { label: "Investimento estimado", value: formatBRLFull(p.valor_estimado) },
    { label: "Capex estimado", value: formatBRLFull(p.capex_estimado) },
    { label: "TIR estimada", value: formatExtra(p.tir_estimada, "percent") },
    { label: "Payback", value: formatExtra(p.payback_anos, "years") },
    { label: "Receita projetada ano 3", value: formatBRLFull(p.receita_projetada_ano3) },
    { label: "TAM", value: formatBRLFull(p.tam) },
    { label: "Volume", value: formatTonDia(p.volume_ton_dia) ?? DASH },
  ];
}

function buildDossieMd(args: {
  projeto: Projeto;
  config: ProjetoConfig;
  responsavel: string;
  lider: string;
  tarefasAbertas: TarefaComContexto[];
  decisoes: DecisaoComite[];
  profilesById: Map<string, Profile>;
}): string {
  const { projeto: p, config, responsavel, lider, tarefasAbertas, decisoes, profilesById } = args;
  const L: string[] = [];
  L.push(`# Dossiê — ${p.nome}`);
  L.push(
    `${config.titulo} · ${config.estagioLabels[p.estagio] ?? p.estagio} · ${STATUS_LABEL[p.status] ?? p.status}`,
  );
  L.push("");
  L.push(`## Identidade`);
  L.push(`- **Contraparte:** ${display(p.contraparte)}`);
  L.push(`- **Setor:** ${display(p.setor)}`);
  if (p.tipo === "novos_negocios") {
    L.push(
      `- **Subcategoria:** ${p.subcategoria ? SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria : DASH}`,
    );
  }
  L.push(`- **Responsável:** ${responsavel}`);
  L.push(`- **Líder:** ${lider}`);
  L.push(`- **% Orizon:** ${formatPercentOrizon(p.percentual_orizon) ?? DASH}`);
  L.push(`- **Início:** ${formatAbsolute(p.data_inicio)}`);
  L.push(`- **Fechamento previsto:** ${formatAbsolute(p.data_fechamento_prevista)}`);
  L.push(`- **Fechamento Realizado:** ${formatAbsolute(p.data_fechamento_real)}`);
  if (p.status_detalhado) L.push(`- **Status detalhado:** ${p.status_detalhado}`);
  L.push("");
  if (p.tese?.trim()) {
    L.push(`## Tese`);
    L.push(p.tese.trim());
    L.push("");
  }
  if (p.riscos?.trim()) {
    L.push(`## Riscos`);
    L.push(p.riscos.trim());
    L.push("");
  }
  if (p.proximos_passos?.trim()) {
    L.push(`## Próximos passos`);
    L.push(p.proximos_passos.trim());
    L.push("");
  }
  if (p.notas_estrategicas?.trim()) {
    L.push(`## Notas estratégicas`);
    L.push(p.notas_estrategicas.trim());
    L.push("");
  }

  L.push(`## Financeiro`);
  for (const row of financeiroRows(p, config.finVariant)) {
    L.push(`- **${row.label}:** ${row.value}`);
  }
  L.push("");

  L.push(`## Tarefas abertas (${tarefasAbertas.length})`);
  if (tarefasAbertas.length === 0) {
    L.push("Nenhuma tarefa aberta.");
  } else {
    for (const t of tarefasAbertas) {
      const resp = t.responsaveis.map((r) => r.nome).join(", ") || DASH;
      L.push(
        `- **${t.titulo}** — ${resp} · prazo ${t.prazo ? formatAbsolute(t.prazo) : "sem prazo"} · ${PRIORIDADE_LABEL[t.prioridade]}`,
      );
    }
  }
  L.push("");

  L.push(`## Decisões de comitê`);
  if (decisoes.length === 0) {
    L.push("Nenhuma decisão de comitê registrada.");
  } else {
    for (const d of decisoes) {
      const dk = (d.decisao as DecisaoKey) ?? "pendente";
      const est = d.estagio_sugerido
        ? config.estagioLabels[d.estagio_sugerido] ?? d.estagio_sugerido
        : DASH;
      L.push(`### ${d.comite_titulo} · ${formatAbsolute(d.comite_data)}`);
      L.push(`- **Decisão:** ${DECISAO_LABEL[dk]}`);
      L.push(`- **Justificativa:** ${d.justificativa?.trim() || DASH}`);
      L.push(`- **Condicionantes:** ${d.condicionantes?.trim() || DASH}`);
      L.push(`- **Estágio sugerido:** ${est}`);
      L.push("");
    }
  }
  void profilesById;
  return L.join("\n").trim() + "\n";
}

function DossiePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openTarefa } = useTarefaDrawer();
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);

  const detailFn = useServerFn(getProjetoDetail);
  const tarefasFn = useServerFn(listTarefasByProjeto);
  const decisoesFn = useServerFn(getDecisoesComiteByProjeto);

  const { data: profData } = useSuspenseQuery(profilesQuery());
  const profiles = profData.profiles;
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const detailQ = useQuery({
    queryKey: ["projeto", id],
    queryFn: () => detailFn({ data: { id } }),
  });
  const tarefasQ = useQuery({
    queryKey: ["tarefas-projeto", id],
    queryFn: () => tarefasFn({ data: { projeto_id: id } }),
  });
  const decisoesQ = useQuery({
    queryKey: ["decisoes-projeto", id],
    queryFn: () => decisoesFn({ data: { projeto_id: id } }),
  });

  if (detailQ.isLoading || !detailQ.data) {
    return (
      <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
        <Skeleton className="h-8 w-1/3 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const { projeto, comentarios, documentos } = detailQ.data;
  const config = projeto.tipo === "ma" ? MA_CONFIG : NN_CONFIG;
  const backTo = projeto.tipo === "ma" ? "/ma" : "/novos-negocios";

  const responsavel =
    (projeto.responsavel_id && profileMap.get(projeto.responsavel_id)?.nome_completo) || DASH;
  const lider =
    (projeto.lider_id && profileMap.get(projeto.lider_id)?.nome_completo) || DASH;
  const health = healthFor(projeto);

  const tarefas = tarefasQ.data?.tarefas ?? [];
  const tarefasAbertas = tarefas.filter(
    (t) => t.status === "pendente" || t.status === "em_andamento",
  );
  const decisoes = decisoesQ.data?.decisoes ?? [];

  const buildMd = () =>
    buildDossieMd({
      projeto,
      config,
      responsavel,
      lider,
      tarefasAbertas,
      decisoes,
      profilesById: profileMap,
    });

  const copyDossie = async () => {
    await navigator.clipboard.writeText(buildMd());
    toast.success("Dossiê copiado para a área de transferência.");
  };

  const downloadDossie = () => {
    const blob = new Blob([buildMd()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossie-${slugify(projeto.nome) || "projeto"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const finRows = financeiroRows(projeto, config.finVariant);
  const ultimosComentarios = [...comentarios].slice(-5).reverse();
  const isMA = projeto.tipo === "ma";

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground px-5 py-4.5 sm:px-6 sm:py-5 shadow-xs border border-primary/20">
        {/* Marca d'água circular oficial da Orizon */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-56 w-56 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 space-y-3.5">
          {/* Linha Superior: Botão Voltar + Ações do Dossiê */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: backTo })}
              className="h-8 px-2.5 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-white" />
              <span>Voltar ao {config.titulo}</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyDossie}
                className="h-8 px-3 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-white" />
                <span className="hidden sm:inline">Copiar dossiê</span>
              </Button>
              <Button
                size="sm"
                onClick={downloadDossie}
                className="h-8 px-3.5 text-xs font-bold bg-white hover:bg-white/90 text-primary hover:text-primary border border-white/90 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer gap-1.5"
              >
                <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Baixar .md</span>
              </Button>
            </div>
          </div>

          {/* Linha Central: Ícone, Título e Badges */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              {isMA ? (
                <Briefcase className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  {projeto.nome}
                </h1>
                <Badge
                  variant="outline"
                  className="bg-white/15 text-white border-white/25 text-[11px] font-semibold uppercase shadow-2xs"
                >
                  {config.titulo}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white/20 text-white font-medium text-[11px]"
                >
                  {config.estagioLabels[projeto.estagio] ?? projeto.estagio}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white/10 text-white/90 border-white/20 text-[11px]"
                >
                  {STATUS_LABEL[projeto.status] ?? projeto.status}
                </Badge>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className={cn("h-2 w-2 rounded-full", HEALTH_BG[health])} />
                  <span>{HEALTH_LABEL[health]}</span>
                </span>
              </div>
              <p className="text-xs text-white/80 font-normal leading-relaxed">
                Contraparte: <strong className="text-white">{display(projeto.contraparte)}</strong> • Setor: {display(projeto.setor)} • Responsável: {responsavel}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. RÉGUA EXECUTIVA DE ESTÁGIOS DO PIPELINE               */}
      {/* ======================================================== */}
      <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Evolução no Pipeline
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            Estágio Atual: <strong className="text-foreground">{config.estagioLabels[projeto.estagio] ?? projeto.estagio}</strong>
          </span>
        </div>
        <ol className="flex flex-wrap gap-2 pt-1">
          {config.estagios.map((s) => {
            const current = s.key === projeto.estagio;
            return (
              <li
                key={s.key}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs transition-all flex items-center gap-1.5",
                  current
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                    : "border-border/70 bg-muted/20 text-muted-foreground font-medium hover:border-border",
                )}
              >
                {current && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground shrink-0" />}
                <span>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* ======================================================== */}
      {/* 3. GRID EXECUTIVO EM 2 COLUNAS (CONTEÚDO PRINCIPAL / GOVERNANÇA) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* COLUNA ESQUERDA (8 COLUNAS): DADOS, TESE E FINANCEIRO */}
        <div className="lg:col-span-8 space-y-5">
          {/* Identidade e Atributos Executivos */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground tracking-tight border-b border-border/60 pb-2 flex items-center justify-between">
              <span>Identidade & Resumo Estratégico</span>
              <span className="text-xs font-mono font-bold text-primary">
                {formatBRLFull(projeto.valor_estimado)}
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Info label="Contraparte" value={display(projeto.contraparte)} />
              <Info label="Setor" value={display(projeto.setor)} />
              {projeto.tipo === "novos_negocios" && (
                <Info
                  label="Subcategoria"
                  value={
                    projeto.subcategoria
                      ? SUBCATEGORIA_LABEL[projeto.subcategoria] ?? projeto.subcategoria
                      : DASH
                  }
                />
              )}
              <Info label="Responsável" value={responsavel} />
              <Info label="Líder" value={lider} />
              <Info
                label="% Orizon"
                value={formatPercentOrizon(projeto.percentual_orizon) ?? DASH}
              />
              <Info label="Data de Início" value={formatAbsolute(projeto.data_inicio)} />
              <Info
                label="Fechamento Previsto"
                value={formatAbsolute(projeto.data_fechamento_prevista)}
              />
              <Info
                label="Fechamento Realizado"
                value={formatAbsolute(projeto.data_fechamento_real)}
              />
            </div>

            {projeto.status_detalhado && (
              <div className="pt-2 border-t border-border/40">
                <Info label="Status Detalhado" value={projeto.status_detalhado} />
              </div>
            )}

            {/* Blocos Descritivos: Tese, Riscos, Próximos Passos */}
            <div className="pt-3 border-t border-border/60 space-y-3">
              <TextBlock title="Tese Estratégica" value={projeto.tese} />
              <TextBlock title="Matriz de Riscos & Pontos de Atenção" value={projeto.riscos} />
              <TextBlock title="Próximos Passos & Plano de Ação" value={projeto.proximos_passos} />
              <TextBlock title="Notas Estratégicas & Contexto" value={projeto.notas_estrategicas} />
            </div>
          </Card>

          {/* Modelagem Financeira */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                Modelagem & Métricas Financeiras
              </h2>
              <span className="text-xs text-muted-foreground font-medium">
                Alocação de Capital OrizonVR
              </span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {finRows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2"
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    {r.label}
                  </dt>
                  <dd className="text-xs sm:text-sm font-bold font-mono text-foreground">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Comentários Recentes */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground tracking-tight border-b border-border/60 pb-2">
              Comentários & Histórico Recente
            </h2>
            {ultimosComentarios.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum comentário registrado ainda.
              </p>
            ) : (
              <ul className="space-y-3 pt-1">
                {ultimosComentarios.map((c) => (
                  <li
                    key={c.id}
                    className="border-b border-border/40 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{c.autor_nome}</span>
                      <span>{formatAbsolute(c.criado_em)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {c.conteudo}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* COLUNA DIREITA (4 COLUNAS): TAREFAS, COMITÊS E DOCUMENTOS */}
        <div className="lg:col-span-4 space-y-5">
          {/* Tarefas Abertas */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-primary" />
                <span>Tarefas do Projeto</span>
                <Badge
                  variant="secondary"
                  className="h-4.5 px-1.5 text-[10px] font-mono font-bold bg-primary/10 text-primary"
                >
                  {tarefasAbertas.length}
                </Badge>
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNovaTarefaOpen(true)}
                className="h-7 text-xs px-2 rounded-lg gap-1 border-border/80"
              >
                <Plus className="h-3 w-3" />
                <span>Tarefa</span>
              </Button>
            </div>

            <NovaTarefaDialog
              open={novaTarefaOpen}
              onOpenChange={(o) => {
                setNovaTarefaOpen(o);
                if (!o) qc.invalidateQueries({ queryKey: ["tarefas-projeto", id] });
              }}
              profiles={profiles}
              projetoFixo={{ id: projeto.id, nome: projeto.nome }}
            />

            {tarefasAbertas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhuma tarefa pendente.
              </p>
            ) : (
              <ul className="space-y-2 pt-1">
                {tarefasAbertas.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => openTarefa(t.id)}
                    className="p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all space-y-1 hover:border-primary/40 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">
                        {t.titulo}
                      </span>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 font-medium shrink-0">
                        {PRIORIDADE_LABEL[t.prioridade]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate max-w-32">
                        {t.responsaveis.map((r) => r.nome).join(", ") || DASH}
                      </span>
                      <span className="font-mono">
                        {t.prazo ? formatAbsolute(t.prazo) : "Sem prazo"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Deliberações de Comitê */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
              Decisões de Comitê
            </h2>
            {decisoes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhuma decisão registrada.
              </p>
            ) : (
              <ul className="space-y-3 pt-1">
                {decisoes.map((d, i) => {
                  const dk = (d.decisao as DecisaoKey) ?? "pendente";
                  return (
                    <li
                      key={`${d.comite_id}-${i}`}
                      className="border-b border-border/40 pb-3 last:border-0 last:pb-0 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold", decisaoBadgeClass(dk))}>
                          {DECISAO_LABEL[dk]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatAbsolute(d.comite_data)}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-foreground">
                        {d.comite_titulo}
                      </div>
                      {d.justificativa && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {d.justificativa}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Documentos do Projeto */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2 flex items-center justify-between">
              <span>Documentos</span>
              <span className="text-[10px] font-mono font-medium text-muted-foreground">
                {documentos.length} arquivos
              </span>
            </h2>
            {documentos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nenhum documento anexado.
              </p>
            ) : (
              <ul className="space-y-2 pt-1">
                {documentos.map((d) => (
                  <li
                    key={d.id}
                    className="p-2 rounded-lg border border-border/60 bg-muted/15 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">{d.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {display(d.tipo)} • {formatAbsolute(d.criado_em)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="rounded-lg bg-muted/20 border border-border/60 p-3 space-y-1">
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {title}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}
