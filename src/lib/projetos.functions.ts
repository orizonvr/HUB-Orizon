import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Profile,
  Projeto,
  Comentario,
  Documento,
  Atividade,
} from "./projetos-types";

// Re-export for back-compat with existing imports.
export {
  MA_ESTAGIOS,
  NN_ESTAGIOS,
  SUBCATEGORIAS,
  SUBCATEGORIA_LABEL,
  type ProjetoTipo,
  type Profile,
  type Projeto,
  type Comentario,
  type Documento,
  type Atividade,
} from "./projetos-types";

type ActorRole = "admin" | "lider" | "analista" | "observador";

async function getActorRole(userId: string): Promise<ActorRole | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role as ActorRole | undefined) ?? null;
}

async function assertNotObservador(userId: string) {
  const role = await getActorRole(userId);
  if (!role || role === "observador") {
    throw new Error("Forbidden: observadores não podem executar esta ação.");
  }
}

async function assertAdmin(userId: string) {
  const role = await getActorRole(userId);
  if (role !== "admin") throw new Error("Forbidden: apenas administradores.");
}

// ---------- LIST ----------
export const listProjetosByTipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ tipo: z.enum(["ma", "novos_negocios"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("projetos")
      .select("*")
      .eq("tipo", data.tipo)
      .order("atualizado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return { projetos: (rows ?? []) as Projeto[] };
  });

export const listMaProjetos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("projetos")
      .select("*")
      .eq("tipo", "ma")
      .order("atualizado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return { projetos: (data ?? []) as Projeto[] };
  });

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, cargo, email, avatar_url, role, ativo")
      .eq("ativo", true)
      .order("nome_completo");
    if (error) throw new Error(error.message);
    return { profiles: (data ?? []) as Profile[] };
  });

// ---------- GET DETAIL ----------
export const getProjetoDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [proj, coms, docs, ativs, profs] = await Promise.all([
      supabaseAdmin.from("projetos").select("*").eq("id", data.id).single(),
      supabaseAdmin
        .from("comentarios")
        .select("*")
        .eq("projeto_id", data.id)
        .order("criado_em", { ascending: true }),
      supabaseAdmin
        .from("documentos")
        .select("*")
        .eq("projeto_id", data.id)
        .order("criado_em", { ascending: false }),
      supabaseAdmin
        .from("atividades")
        .select("*")
        .eq("projeto_id", data.id)
        .order("criado_em", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, nome_completo"),
    ]);

    if (proj.error) throw new Error(proj.error.message);
    const nameMap = new Map<string, string>(
      ((profs.data ?? []) as Array<{ id: string; nome_completo: string }>).map(
        (p) => [p.id, p.nome_completo],
      ),
    );

    return {
      projeto: proj.data as Projeto,
      comentarios: ((coms.data ?? []) as Array<Omit<Comentario, "autor_nome">>).map(
        (c) => ({ ...c, autor_nome: nameMap.get(c.autor_id) ?? "—" }),
      ) as Comentario[],
      documentos: ((docs.data ?? []) as Array<Omit<Documento, "enviado_por_nome">>).map(
        (d) => ({
          ...d,
          enviado_por_nome: nameMap.get(d.enviado_por) ?? "—",
        }),
      ) as Documento[],
      atividades: ((ativs.data ?? []) as Array<
        Omit<Atividade, "autor_nome"> & { detalhes: Record<string, unknown> | null }
      >).map((a) => ({
        ...a,
        detalhes: a.detalhes ?? {},
        autor_nome: a.autor_id ? nameMap.get(a.autor_id) ?? "—" : "Sistema",
      })) as Atividade[],
    };
  });

// ---------- CREATE ----------
const createSchema = z.object({
  tipo: z.enum(["ma", "novos_negocios"]),
  nome: z.string().min(1).max(200),
  contraparte: z.string().min(1).max(200),
  setor: z.string().min(1).max(120),
  subcategoria: z.string().max(120).optional().nullable(),
  estagio: z.string().min(1).max(60),
  responsavel_id: z.string().uuid(),
  valor_estimado: z.number().nonnegative().optional().nullable(),
  data_inicio: z.string().min(1).optional().nullable(),
  data_fechamento_prevista: z.string().min(1).optional().nullable(),
  descricao: z.string().max(4000).optional().nullable(),
  tese: z.string().max(8000).optional().nullable(),
});

export const createProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const { data: inserted, error } = await supabaseAdmin
      .from("projetos")
      .insert({
        tipo: data.tipo,
        status: "ativo",
        nome: data.nome,
        contraparte: data.contraparte,
        setor: data.setor,
        subcategoria: data.subcategoria ?? null,
        estagio: data.estagio,
        responsavel_id: data.responsavel_id,
        valor_estimado: data.valor_estimado ?? 0,
        data_fechamento_prevista: data.data_fechamento_prevista ?? null,
        descricao: data.descricao ?? null,
        tese: data.tese ?? null,
        data_inicio:
          data.data_inicio ?? new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("atividades").insert({
      projeto_id: inserted.id,
      autor_id: actorId,
      acao: "criou_projeto",
      detalhes: { nome: data.nome, estagio: data.estagio, tipo: data.tipo },
    });

    return { projeto: inserted as Projeto };
  });

// ---------- UPDATE ----------
const updatableFields = [
  "nome",
  "contraparte",
  "setor",
  "subcategoria",
  "status_detalhado",
  "estagio",
  "status",
  "descricao",
  "tese",
  "riscos",
  "proximos_passos",
  "responsavel_id",
  "lider_id",
  "data_inicio",
  "data_fechamento_prevista",
  "data_fechamento_real",
  "valor_estimado",
  "ebitda_alvo",
  "ebitda_2025",
  "multiplo_ev_ebitda",
  "sinergias_estimadas",
  "tir_estimada",
  "payback_anos",
  "capex_estimado",
  "receita_projetada_ano3",
  "tam",
  "volume_ton_dia",
  "percentual_orizon",
  "valor_transacao_mm",
  "notas_estrategicas",
  "qualidade_informacoes",
  "volume_ano3",
  "ebitda_ano3",
  "capex_tecnologia",
  "capex_total_nominal",
  "tir_real_projeto",
  "tir_real_acionista",
  "vpl_taxa",
  "vpl_valor",
] as const;

const updateSchema = z.object({
  id: z.string().uuid(),
  patch: z.record(z.string(), z.unknown()),
});

export const updateProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const clean: Record<string, unknown> = {};
    for (const k of updatableFields) {
      if (k in data.patch) clean[k] = data.patch[k] ?? null;
    }
    if (Object.keys(clean).length === 0) return { ok: true as const };

    const { data: ownerRow } = await supabaseAdmin
      .from("projetos")
      .select("responsavel_id, lider_id")
      .eq("id", data.id)
      .single();
    const role = await getActorRole(actorId);
    if (role === "observador") {
      throw new Error("Forbidden: observadores não podem editar projetos.");
    }
    const allowed =
      role === "admin" ||
      ownerRow?.responsavel_id === actorId ||
      ownerRow?.lider_id === actorId;
    if (!allowed) throw new Error("Forbidden: sem permissão para editar este projeto.");


    const { data: before } = await supabaseAdmin
      .from("projetos")
      .select("estagio")
      .eq("id", data.id)
      .single();

    const { error } = await supabaseAdmin
      .from("projetos")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(clean as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if ("estagio" in clean && before && before.estagio !== clean.estagio) {
      await supabaseAdmin.from("atividades").insert({
        projeto_id: data.id,
        autor_id: actorId,
        acao: "mudou_estagio",
        detalhes: { de: before.estagio, para: String(clean.estagio ?? "") },
      });
    } else {
      await supabaseAdmin.from("atividades").insert({
        projeto_id: data.id,
        autor_id: actorId,
        acao: "editou",
        detalhes: { campos: Object.keys(clean) },
      });
    }
    return { ok: true as const };
  });

// ---------- DELETE ----------
export const deleteProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("comentarios").delete().eq("projeto_id", data.id);
    await supabaseAdmin.from("documentos").delete().eq("projeto_id", data.id);
    await supabaseAdmin.from("atividades").delete().eq("projeto_id", data.id);
    const { error } = await supabaseAdmin
      .from("projetos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


// ---------- COMENTARIO ----------
export const addComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        projeto_id: z.string().uuid(),
        conteudo: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const { error } = await supabaseAdmin.from("comentarios").insert({
      projeto_id: data.projeto_id,
      autor_id: actorId,
      conteudo: data.conteudo,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("atividades").insert({
      projeto_id: data.projeto_id,
      autor_id: actorId,
      acao: "comentou",
      detalhes: { preview: data.conteudo.slice(0, 80) },
    });
    return { ok: true as const };
  });

// ---------- DOCUMENTO ----------
export const uploadDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        projeto_id: z.string().uuid(),
        nome: z.string().min(1).max(200),
        tipo: z.string().min(1).max(60),
        mime: z.string().max(120).optional().nullable(),
        size_bytes: z.number().int().nonnegative(),
        content_base64: z.string().min(1).max(27_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const buffer = Buffer.from(data.content_base64, "base64");
    if (buffer.length > 20 * 1024 * 1024) {
      throw new Error("Arquivo excede o limite de 20 MB.");
    }
    if (Math.abs(buffer.byteLength - data.size_bytes) > 1024) {
      throw new Error("Tamanho do arquivo não confere.");
    }
    const path = `${data.projeto_id}/${Date.now()}_${data.nome}`;
    const up = await supabaseAdmin.storage
      .from("documentos")
      .upload(path, buffer, {
        contentType: data.mime ?? "application/octet-stream",
        upsert: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ owner: actorId } as any),
      });
    if (up.error) throw new Error(up.error.message);
    // garante owner mesmo quando service-role ignora o campo no upload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .schema("storage")
      .from("objects")
      .update({ owner: actorId })
      .eq("bucket_id", "documentos")
      .eq("name", path);

    const { error } = await supabaseAdmin.from("documentos").insert({
      projeto_id: data.projeto_id,
      nome: data.nome,
      tipo: data.tipo,
      tamanho_bytes: data.size_bytes,
      url_storage: path,
      enviado_por: actorId,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("atividades").insert({
      projeto_id: data.projeto_id,
      autor_id: actorId,
      acao: "subiu_documento",
      detalhes: { nome: data.nome, tipo: data.tipo },
    });
    return { ok: true as const };
  });

export const getDocumentoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const role = await getActorRole(context.userId);
    if (role === "observador") {
      throw new Error("Forbidden: observadores não podem baixar documentos.");
    }
    const { data: doc, error } = await supabaseAdmin
      .from("documentos")
      .select("url_storage, nome")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const signed = await supabaseAdmin.storage
      .from("documentos")
      .createSignedUrl(doc.url_storage, 60 * 5);
    if (signed.error) throw new Error(signed.error.message);
    return { url: signed.data.signedUrl, nome: doc.nome };
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const { data: doc } = await supabaseAdmin
      .from("documentos")
      .select("url_storage, projeto_id, nome, enviado_por")
      .eq("id", data.id)
      .single();
    if (!doc) return { ok: true as const };
    const role = await getActorRole(actorId);
    if (role === "observador") {
      throw new Error("Forbidden: observadores não podem remover documentos.");
    }
    if (role !== "admin" && doc.enviado_por !== actorId) {
      throw new Error("Forbidden: apenas o autor ou admin pode remover este documento.");
    }
    await supabaseAdmin.storage.from("documentos").remove([doc.url_storage]);
    await supabaseAdmin.from("documentos").delete().eq("id", data.id);
    await supabaseAdmin.from("atividades").insert({
      projeto_id: doc.projeto_id,
      autor_id: actorId,
      acao: "removeu_documento",
      detalhes: { nome: doc.nome },
    });
    return { ok: true as const };
  });
