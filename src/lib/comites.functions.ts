import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ComiteStatus = "preparacao" | "realizado" | "cancelado";

export type ComiteLite = {
  id: string;
  titulo: string;
  data: string;
  status: ComiteStatus;
  participante_ids: string[];
  criado_por_id: string;
  criado_por_nome: string | null;
  criado_em: string;
  pauta_count: number;
};

export type ComiteParticipante = {
  id: string;
  nome_completo: string;
  avatar_url: string | null;
};

export type BriefingCampos = {
  nome: string;
  tipo: "ma" | "novos_negocios";
  estagio: string;
  subcategoria: string | null;
  contraparte: string | null;
  setor: string | null;
  status_detalhado: string | null;
  descricao: string | null;
  tese: string | null;
  riscos: string | null;
  proximos_passos: string | null;
  notas_estrategicas: string | null;
  valor_transacao_mm: number | null;
  ebitda_2025: number | null;
  ebitda_alvo: number | null;
  multiplo_ev_ebitda: number | null;
  sinergias_estimadas: number | null;
  valor_estimado: number | null;
  tir_estimada: number | null;
  payback_anos: number | null;
  capex_estimado: number | null;
  receita_projetada_ano3: number | null;
  tam: number | null;
  volume_ton_dia: number | null;
  percentual_orizon: number | null;
};

export type BriefingSnapshot = {
  texto: string;
  campos: BriefingCampos;
  gerado_em: string;
  gerado_por_id: string;
  origem: "manual" | "ia";
};

export type PautaItem = {
  id: string;
  comite_id: string;
  projeto_id: string;
  ordem: number;
  relator_id: string | null;
  relator_nome: string | null;
  decisao: string | null;
  justificativa: string | null;
  condicionantes: string | null;
  estagio_sugerido: string | null;
  projeto_nome: string;
  projeto_tipo: "ma" | "novos_negocios";
  projeto_estagio: string;
  projeto_contraparte: string | null;
  projeto_valor_transacao_mm: number | null;
  projeto_ebitda_2025: number | null;
  briefing_snapshot: BriefingSnapshot | null;
};

export type ComiteDetail = {
  id: string;
  titulo: string;
  data: string;
  status: ComiteStatus;
  participante_ids: string[];
  participantes: ComiteParticipante[];
  criado_por_id: string;
  criado_por_nome: string | null;
  ata_consolidada: string | null;
  criado_em: string;
  atualizado_em: string;
  pauta: PautaItem[];
};

// ---------- LIST ----------
export const listComites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: rows, error } = await supabaseAdmin
      .from("comites")
      .select("*")
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    const comites = (rows ?? []) as Array<{
      id: string;
      titulo: string;
      data: string;
      status: ComiteStatus;
      participante_ids: string[];
      criado_por_id: string;
      criado_em: string;
    }>;
    if (comites.length === 0) return { comites: [] as ComiteLite[] };

    const ids = comites.map((c) => c.id);
    const creatorIds = Array.from(new Set(comites.map((c) => c.criado_por_id)));
    const [{ data: pauta }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("comite_pauta").select("comite_id").in("comite_id", ids),
      supabaseAdmin
        .from("profiles")
        .select("id, nome_completo")
        .in("id", creatorIds),
    ]);
    const counts = new Map<string, number>();
    for (const p of pauta ?? []) {
      counts.set(p.comite_id, (counts.get(p.comite_id) ?? 0) + 1);
    }
    const nameMap = new Map(
      (profs ?? []).map((p) => [p.id, p.nome_completo as string]),
    );
    const result: ComiteLite[] = comites.map((c) => ({
      ...c,
      criado_por_nome: nameMap.get(c.criado_por_id) ?? null,
      pauta_count: counts.get(c.id) ?? 0,
    }));
    return { comites: result };
  });

// ---------- GET DETAIL ----------
export const getComiteDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: comite, error } = await supabaseAdmin
      .from("comites")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !comite) throw new Error("Comitê não encontrado.");

    const { data: pautaRows } = await supabaseAdmin
      .from("comite_pauta")
      .select("*")
      .eq("comite_id", data.id)
      .order("ordem", { ascending: true });

    const pautaRaw = (pautaRows ?? []) as Array<{
      id: string;
      comite_id: string;
      projeto_id: string;
      ordem: number;
      relator_id: string | null;
      decisao: string | null;
      justificativa: string | null;
      condicionantes: string | null;
      estagio_sugerido: string | null;
      briefing_snapshot: BriefingSnapshot | null;
    }>;

    const projIds = Array.from(new Set(pautaRaw.map((p) => p.projeto_id)));
    const profileIds = Array.from(
      new Set(
        [
          comite.criado_por_id as string,
          ...((comite.participante_ids ?? []) as string[]),
          ...pautaRaw.map((p) => p.relator_id).filter(Boolean) as string[],
        ],
      ),
    );

    const [{ data: projs }, { data: profs }] = await Promise.all([
      projIds.length > 0
        ? supabaseAdmin
            .from("projetos")
            .select(
              "id, nome, tipo, estagio, contraparte, valor_transacao_mm, ebitda_2025",
            )
            .in("id", projIds)
        : Promise.resolve({ data: [] as Array<{
            id: string;
            nome: string;
            tipo: "ma" | "novos_negocios";
            estagio: string;
            contraparte: string | null;
            valor_transacao_mm: number | null;
            ebitda_2025: number | null;
          }> }),
      profileIds.length > 0
        ? supabaseAdmin
            .from("profiles")
            .select("id, nome_completo, avatar_url")
            .in("id", profileIds)
        : Promise.resolve({ data: [] as Array<{
            id: string;
            nome_completo: string;
            avatar_url: string | null;
          }> }),
    ]);

    const pMap = new Map((projs ?? []).map((p) => [p.id, p]));
    const uMap = new Map((profs ?? []).map((p) => [p.id, p]));

    const pauta: PautaItem[] = pautaRaw.map((row) => {
      const proj = pMap.get(row.projeto_id);
      const relator = row.relator_id ? uMap.get(row.relator_id) : null;
      return {
        id: row.id,
        comite_id: row.comite_id,
        projeto_id: row.projeto_id,
        ordem: row.ordem,
        relator_id: row.relator_id,
        relator_nome: relator?.nome_completo ?? null,
        decisao: row.decisao,
        justificativa: row.justificativa,
        condicionantes: row.condicionantes,
        estagio_sugerido: row.estagio_sugerido,
        projeto_nome: proj?.nome ?? "—",
        projeto_tipo: proj?.tipo ?? "ma",
        projeto_estagio: proj?.estagio ?? "—",
        projeto_contraparte: proj?.contraparte ?? null,
        projeto_valor_transacao_mm: proj?.valor_transacao_mm ?? null,
        projeto_ebitda_2025: proj?.ebitda_2025 ?? null,
        briefing_snapshot: row.briefing_snapshot ?? null,
      };
    });

    const participantes: ComiteParticipante[] = ((comite.participante_ids ?? []) as string[])
      .map((id) => {
        const u = uMap.get(id);
        return u
          ? { id: u.id, nome_completo: u.nome_completo, avatar_url: u.avatar_url }
          : { id, nome_completo: "—", avatar_url: null };
      });

    const detail: ComiteDetail = {
      id: comite.id,
      titulo: comite.titulo,
      data: comite.data,
      status: comite.status as ComiteStatus,
      participante_ids: (comite.participante_ids ?? []) as string[],
      participantes,
      criado_por_id: comite.criado_por_id,
      criado_por_nome: uMap.get(comite.criado_por_id)?.nome_completo ?? null,
      ata_consolidada: comite.ata_consolidada,
      criado_em: comite.criado_em,
      atualizado_em: comite.atualizado_em,
      pauta,
    };
    return { comite: detail };
  });

// ---------- CREATE ----------
export const createComite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        titulo: z.string().min(3).max(200),
        data: z.string().min(1),
        participante_ids: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const { data: inserted, error } = await supabaseAdmin
      .from("comites")
      .insert({
        titulo: data.titulo,
        data: data.data,
        participante_ids: Array.from(new Set(data.participante_ids)),
        criado_por_id: actorId,
        status: "preparacao",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { comite: inserted as { id: string } };
  });

// ---------- UPDATE ----------
export const updateComite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().min(3).max(200).optional(),
        data: z.string().min(1).optional(),
        participante_ids: z.array(z.string().uuid()).min(1).max(50).optional(),
        status: z.enum(["preparacao", "realizado", "cancelado"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.status) {
      const { data: before } = await supabaseAdmin
        .from("comites")
        .select("status")
        .eq("id", data.id)
        .single();
      if (!before) throw new Error("Comitê não encontrado.");
      if (data.status === "realizado") {
        throw new Error(
          "Status 'realizado' só é setado pelo fluxo de fechamento do comitê.",
        );
      }
      if (data.status === "cancelado" && before.status !== "preparacao") {
        throw new Error("Só é possível cancelar um comitê em preparação.");
      }
    }
    const patch: Record<string, unknown> = {};
    if (data.titulo !== undefined) patch.titulo = data.titulo;
    if (data.data !== undefined) patch.data = data.data;
    if (data.participante_ids !== undefined)
      patch.participante_ids = Array.from(new Set(data.participante_ids));
    if (data.status !== undefined) patch.status = data.status;

    const { error } = await supabaseAdmin
      .from("comites")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- DELETE ----------
export const deleteComite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("comites")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- PAUTA ----------
export const addProjetoToPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        comite_id: z.string().uuid(),
        projeto_id: z.string().uuid(),
        relator_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: maxRow } = await supabaseAdmin
      .from("comite_pauta")
      .select("ordem")
      .eq("comite_id", data.comite_id)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrdem = (maxRow?.ordem ?? -1) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("comite_pauta")
      .insert({
        comite_id: data.comite_id,
        projeto_id: data.projeto_id,
        relator_id: data.relator_id ?? null,
        ordem: nextOrdem,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Projeto já está na pauta.");
      }
      throw new Error(error.message);
    }
    return { id: inserted.id };
  });

export const removeProjetoFromPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("comite_pauta")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reordenarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        comite_id: z.string().uuid(),
        ordem_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    for (let i = 0; i < data.ordem_ids.length; i++) {
      const { error } = await supabaseAdmin
        .from("comite_pauta")
        .update({ ordem: i })
        .eq("id", data.ordem_ids[i])
        .eq("comite_id", data.comite_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const updatePautaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        relator_id: z.string().uuid().nullable().optional(),
        decisao: z
          .enum([
            "aprovado",
            "aprovado_com_ressalvas",
            "reprovado",
            "adiado",
            "pendente",
          ])
          .optional(),
        justificativa: z.string().max(4000).nullable().optional(),
        condicionantes: z.string().max(4000).nullable().optional(),
        estagio_sugerido: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {};
    if (data.relator_id !== undefined) patch.relator_id = data.relator_id;
    if (data.decisao !== undefined) patch.decisao = data.decisao;
    if (data.justificativa !== undefined) patch.justificativa = data.justificativa;
    if (data.condicionantes !== undefined) patch.condicionantes = data.condicionantes;
    if (data.estagio_sugerido !== undefined)
      patch.estagio_sugerido = data.estagio_sugerido;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("comite_pauta")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- REALIZAR (fechamento) ----------
export const realizarComite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        ata_consolidada: z.string().max(20000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: before, error: bErr } = await supabaseAdmin
      .from("comites")
      .select("status, ata_consolidada, criado_por_id")
      .eq("id", data.id)
      .single();
    if (bErr || !before) throw new Error("Comitê não encontrado.");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    const allowed =
      me?.role === "admin" ||
      me?.role === "lider" ||
      before.criado_por_id === context.userId;
    if (!allowed) throw new Error("Sem permissão para realizar este comitê.");

    if (before.status !== "preparacao") {
      throw new Error("Só é possível realizar um comitê em preparação.");
    }

    const { data: pauta, error: pErr } = await supabaseAdmin
      .from("comite_pauta")
      .select("decisao")
      .eq("comite_id", data.id);
    if (pErr) throw new Error(pErr.message);
    if (!pauta || pauta.length === 0) {
      throw new Error(
        "Adicione ao menos um projeto à pauta antes de realizar.",
      );
    }
    if (pauta.some((p) => !p.decisao || p.decisao === "pendente")) {
      throw new Error(
        "Registre a decisão de todos os projetos antes de realizar o comitê.",
      );
    }

    const nextAta =
      data.ata_consolidada !== undefined && data.ata_consolidada !== null
        ? data.ata_consolidada
        : before.ata_consolidada;

    const { error: uErr } = await supabaseAdmin
      .from("comites")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status: "realizado", ata_consolidada: nextAta } as any)
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true as const };
  });

// ---------- BRIEFING ----------
const BRIEFING_PROJETO_COLS =
  "nome, tipo, estagio, subcategoria, contraparte, setor, status_detalhado, descricao, tese, riscos, proximos_passos, notas_estrategicas, valor_transacao_mm, ebitda_2025, ebitda_alvo, multiplo_ev_ebitda, sinergias_estimadas, valor_estimado, tir_estimada, payback_anos, capex_estimado, receita_projetada_ano3, tam, volume_ton_dia, percentual_orizon";

async function loadCamposProjeto(projetoId: string): Promise<BriefingCampos> {
  const { data, error } = await supabaseAdmin
    .from("projetos")
    .select(BRIEFING_PROJETO_COLS)
    .eq("id", projetoId)
    .single();
  if (error || !data) throw new Error("Projeto não encontrado.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data as any;
  return {
    nome: p.nome,
    tipo: p.tipo,
    estagio: p.estagio,
    subcategoria: p.subcategoria,
    contraparte: p.contraparte,
    setor: p.setor,
    status_detalhado: p.status_detalhado,
    descricao: p.descricao,
    tese: p.tese,
    riscos: p.riscos,
    proximos_passos: p.proximos_passos,
    notas_estrategicas: p.notas_estrategicas,
    valor_transacao_mm: p.valor_transacao_mm,
    ebitda_2025: p.ebitda_2025,
    ebitda_alvo: p.ebitda_alvo,
    multiplo_ev_ebitda: p.multiplo_ev_ebitda,
    sinergias_estimadas: p.sinergias_estimadas,
    valor_estimado: p.valor_estimado,
    tir_estimada: p.tir_estimada,
    payback_anos: p.payback_anos,
    capex_estimado: p.capex_estimado,
    receita_projetada_ano3: p.receita_projetada_ano3,
    tam: p.tam,
    volume_ton_dia: p.volume_ton_dia,
    percentual_orizon: p.percentual_orizon,
  };
}

async function ensureBriefingPermission(
  pautaId: string,
  userId: string,
  requirePreparacao: boolean,
): Promise<{ comite_id: string; projeto_id: string }> {
  const { data: pauta, error: pErr } = await supabaseAdmin
    .from("comite_pauta")
    .select("comite_id, projeto_id")
    .eq("id", pautaId)
    .single();
  if (pErr || !pauta) throw new Error("Item da pauta não encontrado.");
  const { data: comite, error: cErr } = await supabaseAdmin
    .from("comites")
    .select("status, criado_por_id")
    .eq("id", pauta.comite_id)
    .single();
  if (cErr || !comite) throw new Error("Comitê não encontrado.");
  if (requirePreparacao && comite.status !== "preparacao") {
    throw new Error(
      "Briefing só pode ser editado com o comitê em preparação.",
    );
  }
  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (me as any)?.role;
  const allowed =
    role === "admin" || role === "lider" || comite.criado_por_id === userId;
  if (!allowed) throw new Error("Sem permissão para editar o briefing.");
  return { comite_id: pauta.comite_id, projeto_id: pauta.projeto_id };
}

export const getBriefingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: pauta, error } = await supabaseAdmin
      .from("comite_pauta")
      .select("projeto_id, briefing_snapshot")
      .eq("id", data.pauta_id)
      .single();
    if (error || !pauta) throw new Error("Item da pauta não encontrado.");
    const campos_atuais = await loadCamposProjeto(pauta.projeto_id);
    return {
      projeto_nome: campos_atuais.nome,
      campos_atuais,
      briefing: (pauta.briefing_snapshot as BriefingSnapshot | null) ?? null,
    };
  });

export const salvarBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        pauta_id: z.string().uuid(),
        texto: z.string().max(20000),
        origem: z.enum(["manual", "ia"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { projeto_id } = await ensureBriefingPermission(
      data.pauta_id,
      context.userId,
      true,
    );
    const campos = await loadCamposProjeto(projeto_id);
    const snapshot: BriefingSnapshot = {
      texto: data.texto,
      campos,
      gerado_em: new Date().toISOString(),
      gerado_por_id: context.userId,
      origem: data.origem,
    };
    const { error } = await supabaseAdmin
      .from("comite_pauta")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ briefing_snapshot: snapshot as any } as any)
      .eq("id", data.pauta_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const gerarBriefingIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { projeto_id } = await ensureBriefingPermission(
      data.pauta_id,
      context.userId,
      true,
    );
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { configured: false as const };
    const campos = await loadCamposProjeto(projeto_id);
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 1500,
        system:
          "Você é analista de M&A da Orizon. Escreva um briefing de comitê de investimento em português do Brasil, conciso (1 página), em markdown, com as seções: Resumo, Tese de investimento, Números-chave, Principais riscos, Próximos passos, e Recomendação/pedido ao comitê. Use apenas os dados fornecidos; não invente números. Se um dado faltar, escreva '—'.",
        messages: [{ role: "user", content: JSON.stringify(campos) }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Falha na geração com IA (${resp.status}): ${txt.slice(0, 200)}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (await resp.json()) as any;
    const texto = (json.content ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    return { configured: true as const, texto };
  });

// ---------- DECISÕES POR PROJETO (read-only) ----------
export type DecisaoComite = {
  comite_id: string;
  comite_titulo: string;
  comite_data: string;
  decisao: string | null;
  justificativa: string | null;
  condicionantes: string | null;
  estagio_sugerido: string | null;
};

export const getDecisoesComiteByProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projeto_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("comite_pauta")
      .select(
        "decisao, justificativa, condicionantes, estagio_sugerido, comites!inner(id, titulo, data, status)",
      )
      .eq("projeto_id", data.projeto_id)
      .eq("comites.status", "realizado");
    if (error) throw new Error(error.message);
    type Row = {
      decisao: string | null;
      justificativa: string | null;
      condicionantes: string | null;
      estagio_sugerido: string | null;
      comites: { id: string; titulo: string; data: string; status: string };
    };
    const decisoes: DecisaoComite[] = ((rows ?? []) as unknown as Row[])
      .map((r) => ({
        comite_id: r.comites.id,
        comite_titulo: r.comites.titulo,
        comite_data: r.comites.data,
        decisao: r.decisao,
        justificativa: r.justificativa,
        condicionantes: r.condicionantes,
        estagio_sugerido: r.estagio_sugerido,
      }))
      .sort((a, b) => (a.comite_data < b.comite_data ? 1 : -1));
    return { decisoes };
  });
