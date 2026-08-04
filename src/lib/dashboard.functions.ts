import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NN_ESTAGIOS } from "@/lib/projetos-types";

export type TipoFiltro = "tudo" | "ma" | "novos_negocios";

export type DashboardKpis = {
  transacoesAtivas: number;
  pipelineAgregado: number;
  emDueDiligence: number;
  closingsTrimestre: number;
  volumeMaTotal: number;
  ebitda2025MaTotal: number;
  receitaLiquidaNnTotal: number;
  ebitdaNnTotal: number;
};

export type PipelineStageItem = {
  stage: string;
  label: string;
  value: number;
  amount: number;
};

export type UpcomingAction = {
  id: string;
  date: string;
  title: string;
  project: string;
  owner: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type ActivityFeedItem = {
  id: string;
  when: string;
  actor: string;
  acao: string;
  detalhes: { [k: string]: JsonValue };
  projeto: string;
  tipo: "ma" | "novos_negocios";
};

export type EvolutionPoint = {
  mes: string; // yyyy-mm
  label: string;
  total: number;
};

export type TopProjeto = {
  id: string;
  nome: string;
  tipo: "ma" | "novos_negocios";
  valor: number;
  estagio: string;
};

export type Alerta = {
  id: string;
  projeto: string;
  tipo: "ma" | "novos_negocios";
  nivel: "alto" | "medio";
  motivo: string;
};

export type SubcategoriaItem = {
  key: string;
  label: string;
  count: number;
  amount: number;
};

export type DashboardData = {
  kpis: DashboardKpis;
  pipeline: PipelineStageItem[];
  upcoming: UpcomingAction[];
  feed: ActivityFeedItem[];
  totalProjetos: number;
  evolucao: EvolutionPoint[];
  top5: TopProjeto[];
  alertas: Alerta[];
  subcategorias: SubcategoriaItem[];
};

const MA_STAGES = [
  { key: "analise_inicial", label: "Análise Inicial" },
  { key: "nda_preenchimento", label: "NDA em preenchimento" },
  { key: "nda_assinado", label: "NDA assinado" },
  { key: "elaborando_nbo", label: "Elaborando NBO" },
  { key: "nbo_submetida", label: "NBO submetida" },
  { key: "due_diligence", label: "Due Diligence" },
  { key: "negociacao", label: "Negociação" },
  { key: "opcao_compra_assinada", label: "Opção de Compra Assinada" },
  { key: "assinatura_spa", label: "Assinatura do SPA" },
  { key: "pos_ma_integracao", label: "Pós-M&A / Integração" },
];

const NN_STAGES = NN_ESTAGIOS.map((s) => ({ key: s.key as string, label: s.label as string }));

// Barras exibidas no dashboard quando o filtro é Novos Negócios.
const NN_BUCKETS: Array<{ label: string; keys: string[] }> = [
  { label: "Discussões Iniciais", keys: ["discussoes_iniciais"] },
  { label: "Modelagem Inicial", keys: ["modelagem_inicial"] },
  { label: "Discussões com Offtaker", keys: ["discussoes_offtaker"] },
  { label: "Discussões com Fornecedores", keys: ["discussoes_fornecedores"] },
  { label: "Materiais Finais", keys: ["materiais_finais"] },
  { label: "Implementação / Operação", keys: ["implementacao", "operacao"] },
];

const SUBCAT_LABELS: Record<string, string> = {
  biometano: "Biometano",
  co2: "CO2",
  energia: "Energia",
  economia_circular: "Economia Circular",
  waste_to_energy: "Waste-to-Energy",
  aterros_greenfield: "Aterros Greenfield",
  licitacoes_ppps: "Licitações/PPPs",
};

const CONSOLIDATED_BUCKETS: Array<{ label: string; ma: string[]; nn: string[] }> = [
  { label: "Originação", ma: ["analise_inicial", "nda_preenchimento", "nda_assinado"], nn: ["discussoes_iniciais", "modelagem_inicial"] },
  { label: "Proposta / Offtaker", ma: ["elaborando_nbo", "nbo_submetida"], nn: ["discussoes_offtaker", "discussoes_fornecedores"] },
  { label: "Due Diligence / Comitê", ma: ["due_diligence"], nn: [] },
  { label: "Negociação", ma: ["negociacao", "opcao_compra_assinada", "assinatura_spa"], nn: ["materiais_finais"] },
  { label: "Implementação / Operação", ma: ["pos_ma_integracao"], nn: ["implementacao", "operacao"] },
];

function formatEstagio(estagio: string): string {
  return [...MA_STAGES, ...NN_STAGES].find((s) => s.key === estagio)?.label ?? estagio;
}

function quarterRange(d = new Date()): { start: string; end: string } {
  const month = d.getMonth();
  const qStart = Math.floor(month / 3) * 3;
  const start = new Date(d.getFullYear(), qStart, 1);
  const end = new Date(d.getFullYear(), qStart + 3, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export const getDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ tipo: z.enum(["tudo", "ma", "novos_negocios"]).default("tudo") }).parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<DashboardData> => {
    const { start, end } = quarterRange();
    const tipoFilter = data.tipo;

    type ProjRow = {
      id: string;
      tipo: "ma" | "novos_negocios";
      nome: string;
      estagio: string;
      status: string;
      subcategoria: string | null;
      valor_estimado: number | null;
      volume_ton_dia: number | null;
      ebitda_2025: number | null;
      capex_total_nominal: number | null;
      receita_projetada_ano3: number | null;
      ebitda_ano3: number | null;
      data_fechamento_prevista: string | null;
      criado_em: string;
      atualizado_em: string;
      responsavel_id: string | null;
    };

    const { data: projetosRaw, error: projErr } = await supabaseAdmin
      .from("projetos")
      .select("*");
    if (projErr) throw new Error(projErr.message);
    const projetos = (projetosRaw ?? []) as unknown as ProjRow[];

    const filtered = (projetos ?? []).filter(
      (p) => tipoFilter === "tudo" || p.tipo === tipoFilter,
    );
    const ativos = filtered.filter((p) => p.status === "ativo");

    const kpis: DashboardKpis = {
      transacoesAtivas: ativos.length,
      pipelineAgregado:
        tipoFilter === "novos_negocios"
          ? ativos.reduce((s, p) => s + Number(p.capex_total_nominal ?? 0), 0)
          : ativos.reduce((s, p) => s + Number(p.valor_estimado ?? 0), 0),
      emDueDiligence: ativos.filter(
        (p) => p.estagio === "due_diligence" || p.estagio === "aprovacao_comite",
      ).length,
      closingsTrimestre: ativos.filter(
        (p) => p.data_fechamento_prevista && p.data_fechamento_prevista >= start && p.data_fechamento_prevista <= end,
      ).length,
      volumeMaTotal: ativos
        .filter((p) => p.tipo === "ma")
        .reduce((s, p) => s + Number(p.volume_ton_dia ?? 0), 0),
      ebitda2025MaTotal: ativos
        .filter((p) => p.tipo === "ma")
        .reduce((s, p) => s + Number(p.ebitda_2025 ?? 0), 0),
      receitaLiquidaNnTotal: ativos
        .filter((p) => p.tipo === "novos_negocios")
        .reduce((s, p) => s + Number(p.receita_projetada_ano3 ?? 0), 0),
      ebitdaNnTotal: ativos
        .filter((p) => p.tipo === "novos_negocios")
        .reduce((s, p) => s + Number(p.ebitda_ano3 ?? 0), 0),
    };

    const pipeline: PipelineStageItem[] =
      tipoFilter === "novos_negocios"
        ? NN_BUCKETS.map((b) => {
            const matching = ativos.filter((p) => b.keys.includes(p.estagio));
            return {
              stage: b.label,
              label: b.label,
              value: matching.length,
              amount: matching.reduce(
                (s, p) => s + Number(p.capex_total_nominal ?? 0),
                0,
              ),
            };
          })
        : CONSOLIDATED_BUCKETS.map((b) => {
      const matching = ativos.filter(
        (p) =>
          (p.tipo === "ma" && b.ma.includes(p.estagio)) ||
          (p.tipo === "novos_negocios" && b.nn.includes(p.estagio)),
      );
      return {
        stage: b.label,
        label: b.label,
        value: matching.length,
        amount: matching.reduce((s, p) => s + Number(p.valor_estimado ?? 0), 0),
      };
    });

    const todayIso = new Date().toISOString().slice(0, 10);
    const sortedUpcoming = ativos
      .filter((p) => p.data_fechamento_prevista && p.data_fechamento_prevista >= todayIso)
      .sort((a, b) => (a.data_fechamento_prevista as string).localeCompare(b.data_fechamento_prevista as string))
      .slice(0, 5);

    const respIds = Array.from(
      new Set(sortedUpcoming.map((p) => p.responsavel_id).filter((x): x is string => Boolean(x))),
    );
    let respMap = new Map<string, string>();
    if (respIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome_completo")
        .in("id", respIds);
      respMap = new Map((profs ?? []).map((p) => [p.id as string, p.nome_completo as string]));
    }

    const upcoming: UpcomingAction[] = sortedUpcoming.map((p) => ({
      id: p.id as string,
      date: p.data_fechamento_prevista as string,
      title: `Próximo marco: ${formatEstagio(p.estagio)}`,
      project: `${p.tipo === "ma" ? "M&A" : "Novos Negócios"} · ${p.nome}`,
      owner: p.responsavel_id ? respMap.get(p.responsavel_id) ?? "—" : "—",
    }));

    // ----- Evolução (últimos 6 meses, projetos ativos criados acumulado) -----
    const now = new Date();
    const months: { key: string; label: string; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", "");
      months.push({ key, label, date: d });
    }
    const evolucao: EvolutionPoint[] = months.map((m) => {
      const endOfMonth = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0);
      const total = filtered.filter((p) => {
        const created = new Date(p.criado_em as string);
        return created <= endOfMonth && p.status === "ativo";
      }).length;
      return { mes: m.key, label: m.label, total };
    });

    // ----- Top 5 por valor -----
    const top5: TopProjeto[] = ativos
      .slice()
      .sort((a, b) => Number(b.valor_estimado ?? 0) - Number(a.valor_estimado ?? 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        tipo: p.tipo as "ma" | "novos_negocios",
        valor: Number(p.valor_estimado ?? 0),
        estagio: formatEstagio(p.estagio),
      }));

    // ----- Alertas -----
    const ms30 = 30 * 86400 * 1000;
    const alertas: Alerta[] = [];
    for (const p of ativos) {
      // 1. fechamento atrasado
      if (p.data_fechamento_prevista && p.data_fechamento_prevista < todayIso) {
        alertas.push({
          id: `late-${p.id}`,
          projeto: p.nome as string,
          tipo: p.tipo as "ma" | "novos_negocios",
          nivel: "alto",
          motivo: `Fechamento previsto em ${p.data_fechamento_prevista} venceu.`,
        });
      }
      // 2. sem atualização há 30+ dias
      const last = new Date(p.atualizado_em as string).getTime();
      if (Date.now() - last > ms30) {
        const dias = Math.floor((Date.now() - last) / 86400000);
        alertas.push({
          id: `stale-${p.id}`,
          projeto: p.nome as string,
          tipo: p.tipo as "ma" | "novos_negocios",
          nivel: dias > 60 ? "alto" : "medio",
          motivo: `Sem atualização há ${dias} dias.`,
        });
      }
    }
    alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alto" ? -1 : 1));

    // ----- Feed -----
    const feedQuery = supabaseAdmin
      .from("atividades")
      .select(
        "id, acao, detalhes, criado_em, projeto_id, autor_id, projetos(nome, tipo), profiles(nome_completo)",
      )
      .order("criado_em", { ascending: false })
      .limit(12);

    const { data: ativsRaw, error: ativErr } = await feedQuery;
    if (ativErr) throw new Error(ativErr.message);

    type AtivRow = {
      id: string;
      acao: string;
      detalhes: { [k: string]: JsonValue } | null;
      criado_em: string;
      projetos: { nome: string; tipo: "ma" | "novos_negocios" } | null;
      profiles: { nome_completo: string } | null;
    };

    const feed: ActivityFeedItem[] = (ativsRaw as unknown as AtivRow[] ?? [])
      .filter((a) => tipoFilter === "tudo" || a.projetos?.tipo === tipoFilter)
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        when: a.criado_em,
        actor: a.profiles?.nome_completo ?? "Sistema",
        acao: a.acao,
        detalhes: a.detalhes ?? {},
        projeto: a.projetos?.nome ?? "—",
        tipo: a.projetos?.tipo ?? "ma",
      }));

    // Subcategorias (apenas Novos Negócios) — somatórios para Dashboard
    const subAcc = new Map<string, { count: number; amount: number }>();
    for (const p of ativos) {
      if (p.tipo !== "novos_negocios" || !p.subcategoria) continue;
      const k = String(p.subcategoria);
      const cur = subAcc.get(k) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(p.valor_estimado ?? 0);
      subAcc.set(k, cur);
    }
    const subcategorias: SubcategoriaItem[] = Array.from(subAcc.entries())
      .map(([key, v]) => ({ key, label: SUBCAT_LABELS[key] ?? key, count: v.count, amount: v.amount }))
      .sort((a, b) => b.count - a.count);

    return {
      kpis,
      pipeline,
      upcoming,
      feed,
      totalProjetos: ativos.length,
      evolucao,
      top5,
      alertas: alertas.slice(0, 6),
      subcategorias,
    };
  });
