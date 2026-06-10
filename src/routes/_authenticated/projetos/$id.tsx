import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getProjetoDetail } from "@/lib/projetos.functions";
import {
  listTarefasByProjeto,
  PRIORIDADE_LABEL,
} from "@/lib/tarefas.functions";
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
      return "bg-primary/15 text-primary border-transparent";
    case "aprovado_com_ressalvas":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-transparent";
    case "reprovado":
      return "bg-destructive/15 text-destructive border-transparent";
    case "adiado":
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "bg-muted text-muted-foreground border-transparent";
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
  L.push(`- **Fechamento real:** ${formatAbsolute(p.data_fechamento_real)}`);
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
        `- **${t.titulo}** — ${resp} · prazo ${formatAbsolute(t.prazo)} · ${PRIORIDADE_LABEL[t.prioridade]}`,
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
  // silence unused warning
  void profilesById;
  return L.join("\n").trim() + "\n";
}

function DossiePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

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
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
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
    toast.success("Dossiê copiado.");
  };

  const downloadDossie = () => {
    const blob = new Blob([buildMd()], { type: "text/markdown" });
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

  // TODO: timeline a partir de atividades 'mudou_estagio'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate({ to: backTo })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {config.titulo}
        </Button>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{config.titulo}</Badge>
              <Badge variant="secondary">
                {config.estagioLabels[projeto.estagio] ?? projeto.estagio}
              </Badge>
              <Badge variant="outline">
                {STATUS_LABEL[projeto.status] ?? projeto.status}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", HEALTH_BG[health])} />
                {HEALTH_LABEL[health]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyDossie}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar dossiê
            </Button>
            <Button size="sm" onClick={downloadDossie}>
              <Download className="mr-2 h-4 w-4" />
              Baixar .md
            </Button>
          </div>
        </div>
      </div>

      {/* Régua de estágios */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Estágio</h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {config.estagios.map((s) => {
            const current = s.key === projeto.estagio;
            return (
              <li
                key={s.key}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  current
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Resumo executivo */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold">Resumo executivo</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Info label="% Orizon" value={formatPercentOrizon(projeto.percentual_orizon) ?? DASH} />
          <Info label="Início" value={formatAbsolute(projeto.data_inicio)} />
          <Info label="Fechamento previsto" value={formatAbsolute(projeto.data_fechamento_prevista)} />
          <Info label="Fechamento real" value={formatAbsolute(projeto.data_fechamento_real)} />
          {projeto.status_detalhado && (
            <Info label="Status detalhado" value={projeto.status_detalhado} />
          )}
        </div>
        <TextBlock title="Tese" value={projeto.tese} />
        <TextBlock title="Riscos" value={projeto.riscos} />
        <TextBlock title="Próximos passos" value={projeto.proximos_passos} />
        <TextBlock title="Notas estratégicas" value={projeto.notas_estrategicas} />
      </Card>

      {/* Financeiro */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Financeiro</h2>
          <span className="text-xs text-muted-foreground">
            Será enriquecido pelo modelo financeiro.
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {finRows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {r.label}
              </dt>
              <dd className="text-sm font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Tarefas abertas */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">
          Tarefas abertas{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({tarefasAbertas.length})
          </span>
        </h2>
        {tarefasAbertas.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma tarefa aberta.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tarefasAbertas.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{t.titulo}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {PRIORIDADE_LABEL[t.prioridade]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.responsaveis.map((r) => r.nome).join(", ") || DASH} ·
                  prazo {formatAbsolute(t.prazo)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Decisões de comitê */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Decisões de comitê</h2>
        {decisoes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma decisão de comitê registrada.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {decisoes.map((d, i) => {
              const dk = (d.decisao as DecisaoKey) ?? "pendente";
              const est = d.estagio_sugerido
                ? config.estagioLabels[d.estagio_sugerido] ?? d.estagio_sugerido
                : DASH;
              return (
                <li
                  key={`${d.comite_id}-${i}`}
                  className="border-b border-border/40 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={decisaoBadgeClass(dk)}>
                      {DECISAO_LABEL[dk]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {d.comite_titulo} · {formatAbsolute(d.comite_data)}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <FieldInline label="Justificativa" value={d.justificativa} />
                    <FieldInline label="Condicionantes" value={d.condicionantes} />
                    <FieldInline label="Estágio sugerido" value={est} />
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Documentos */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Documentos</h2>
        {documentos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum documento.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {documentos.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {display(d.tipo)} · {d.enviado_por_nome} · {formatAbsolute(d.criado_em)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Comentários recentes */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Comentários recentes</h2>
        {ultimosComentarios.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum comentário.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {ultimosComentarios.map((c) => (
              <li
                key={c.id}
                className="border-b border-border/40 pb-3 last:border-0 last:pb-0"
              >
                <div className="text-xs text-muted-foreground">
                  {c.autor_nome} · {formatAbsolute(c.criado_em)}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.conteudo}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function FieldInline({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const v = (value ?? "").trim();
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap">{v || DASH}</dd>
    </div>
  );
}
