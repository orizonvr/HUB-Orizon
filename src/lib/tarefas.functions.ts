import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Tarefa,
  TarefaComContexto,
  ResponsavelLite,
  TarefaComentario,
  TarefaSubtarefa,
  TarefaTipo,
} from "./tarefas-types";
import { enqueueNotificacaoTarefa } from "./notificacoes.server";

export type { Tarefa, TarefaComContexto, TarefaComentario, TarefaSubtarefa, TarefaTipo } from "./tarefas-types";

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

async function enrichTarefas(rows: Tarefa[]): Promise<TarefaComContexto[]> {
  if (rows.length === 0) return [];
  const projIds = Array.from(new Set(rows.map((r) => r.projeto_id)));
  const respIds = Array.from(new Set(rows.flatMap((r) => r.responsavel_ids ?? [])));
  const depIds = Array.from(
    new Set(
      rows
        .map((r) => r.dependencia_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const allProfileIds = Array.from(new Set([...respIds, ...depIds]));

  const [projs, profs] = await Promise.all([
    supabaseAdmin.from("projetos").select("id, nome, tipo").in("id", projIds),
    allProfileIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id, nome_completo, avatar_url")
          .in("id", allProfileIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome_completo: string; avatar_url: string | null }> }),
  ]);

  const pMap = new Map(
    (projs.data ?? []).map((p) => [
      p.id,
      p as { id: string; nome: string; tipo: "ma" | "novos_negocios" },
    ]),
  );
  const uMap = new Map(
    (profs.data ?? []).map((p) => [
      p.id,
      p as { id: string; nome_completo: string; avatar_url: string | null },
    ]),
  );

  // Subtarefas contadores agrupados por tarefa em chunks de 80 IDs (evita HeadersOverflowError no PostgREST)
  const taskIds = rows.map((r) => r.id);
  const subStatsMap = new Map<string, { total: number; concluidas: number }>();
  try {
    if (taskIds.length > 0) {
      const CHUNK_SIZE = 80;
      const chunks: string[][] = [];
      for (let i = 0; i < taskIds.length; i += CHUNK_SIZE) {
        chunks.push(taskIds.slice(i, i + CHUNK_SIZE));
      }

      const results = await Promise.all(
        chunks.map((chunk) =>
          supabaseAdmin
            .from("tarefas_subtarefas")
            .select("tarefa_id, concluida")
            .in("tarefa_id", chunk),
        ),
      );

      for (const { data: subRows, error } of results) {
        if (!error && subRows) {
          for (const s of subRows as Array<{ tarefa_id: string; concluida: boolean }>) {
            const cur = subStatsMap.get(s.tarefa_id) ?? { total: 0, concluidas: 0 };
            cur.total += 1;
            if (s.concluida) cur.concluidas += 1;
            subStatsMap.set(s.tarefa_id, cur);
          }
        }
      }
    }
  } catch {
    // Tabela pode ainda estar pendente de criação na migration
  }

  return rows.map((t) => {
    const responsaveis: ResponsavelLite[] = (t.responsavel_ids ?? [])
      .map((id) => {
        const u = uMap.get(id);
        return u
          ? { id: u.id, nome: u.nome_completo, avatar_url: u.avatar_url }
          : { id, nome: "—", avatar_url: null };
      });

    let dependencia_nome: string | null = null;
    if (t.dependencia_terceiro) {
      dependencia_nome = "Terceiros";
    } else if (t.dependencia_id) {
      dependencia_nome = uMap.get(t.dependencia_id)?.nome_completo ?? "—";
    }

    const subStats = subStatsMap.get(t.id);

    return {
      ...t,
      tipo: (t.tipo as TarefaTipo) ?? "tarefa",
      dependencia_terceiro: !!t.dependencia_terceiro,
      dependencia_id: t.dependencia_id ?? null,
      dependencia_nome,
      subtarefas_count: subStats?.total ?? 0,
      subtarefas_concluidas: subStats?.concluidas ?? 0,
      projeto_nome: pMap.get(t.projeto_id)?.nome ?? "—",
      projeto_tipo: pMap.get(t.projeto_id)?.tipo ?? "ma",
      responsaveis,
    };
  });
}

// ---------- GET ONE ----------
export const getTarefaById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("tarefas")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Tarefa não encontrada.");
    const [t] = await enrichTarefas([row as Tarefa]);
    return { tarefa: t };
  });

// ---------- LIST ----------
export const listTarefasByProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ projeto_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("tarefas")
      .select("*")
      .eq("projeto_id", data.projeto_id)
      .order("prazo", { ascending: true });
    if (error) throw new Error(error.message);
    return { tarefas: await enrichTarefas((rows ?? []) as Tarefa[]) };
  });

export const listTarefasByTipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({ tipo: z.enum(["ma", "novos_negocios"]).optional().nullable() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    let projIds: string[] | null = null;
    if (data.tipo) {
      const { data: projs } = await supabaseAdmin
        .from("projetos")
        .select("id")
        .eq("tipo", data.tipo);
      projIds = (projs ?? []).map((p) => p.id);
      if (projIds.length === 0) return { tarefas: [] };
    }
    let query = supabaseAdmin
      .from("tarefas")
      .select("*")
      .order("prazo", { ascending: true });
    if (projIds) query = query.in("projeto_id", projIds);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { tarefas: await enrichTarefas((rows ?? []) as Tarefa[]) };
  });

export const listAllProjetosLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("projetos")
      .select("id, nome, tipo")
      .order("nome");
    if (error) throw new Error(error.message);
    return {
      projetos: (data ?? []) as Array<{
        id: string;
        nome: string;
        tipo: "ma" | "novos_negocios";
      }>,
    };
  });

export const listMinhasTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("tarefas")
      .select("*")
      .contains("responsavel_ids", [context.userId])
      .in("status", ["pendente", "em_andamento"])
      .order("prazo", { ascending: true });
    if (error) throw new Error(error.message);
    return { tarefas: await enrichTarefas((rows ?? []) as Tarefa[]) };
  });

export const resumoTarefasTime = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await getActorRole(context.userId);
    if (role !== "admin" && role !== "lider") {
      return { resumo: [] };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("tarefas")
      .select("responsavel_ids, prazo, status, tipo")
      .in("status", ["pendente", "em_andamento"]);
    if (error) throw new Error(error.message);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<
      string,
      { vencidas: number; em_3_dias: number; proximas: number; total: number }
    >();
    for (const r of rows ?? []) {
      const isAcompanhamento = r.tipo === "acompanhamento";
      let diff = 999;
      if (r.prazo) {
        const prazo = new Date(r.prazo + "T00:00:00");
        diff = Math.round(
          (prazo.getTime() - today.getTime()) / 86_400_000,
        );
      }
      for (const respId of (r.responsavel_ids ?? []) as string[]) {
        const cur = map.get(respId) ?? {
          vencidas: 0,
          em_3_dias: 0,
          proximas: 0,
          total: 0,
        };
        cur.total += 1;
        // Tarefas de acompanhamento NÃO computam em vencidas/atrasadas
        if (!isAcompanhamento && r.prazo) {
          if (diff < 0) cur.vencidas += 1;
          else if (diff <= 3) cur.em_3_dias += 1;
          else cur.proximas += 1;
        } else {
          cur.proximas += 1;
        }
        map.set(respId, cur);
      }
    }
    const ids = Array.from(map.keys());
    if (ids.length === 0) return { resumo: [] };
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, avatar_url")
      .in("id", ids);
    const profMap = new Map(
      (profs ?? []).map((p) => [
        p.id,
        p as { id: string; nome_completo: string; avatar_url: string | null },
      ]),
    );
    const resumo = ids
      .map((id) => ({
        responsavel_id: id,
        responsavel_nome: profMap.get(id)?.nome_completo ?? "—",
        responsavel_avatar: profMap.get(id)?.avatar_url ?? null,
        ...map.get(id)!,
      }))
      .sort((a, b) => b.vencidas - a.vencidas);
    return { resumo };
  });

export const contarAlertasTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limite = new Date(today);
    limite.setDate(limite.getDate() + 3);
    const limiteStr = limite.toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("tarefas")
      .select("id, tipo")
      .contains("responsavel_ids", [context.userId])
      .in("status", ["pendente", "em_andamento"])
      .neq("tipo", "acompanhamento")
      .lte("prazo", limiteStr);
    return { count: (rows ?? []).length };
  });

// ---------- CREATE ----------
const createSchema = z.object({
  projeto_id: z.string().uuid(),
  titulo: z.string().min(1).max(300),
  descricao: z.string().max(4000).optional().nullable(),
  responsavel_ids: z.array(z.string().uuid()).min(1).max(20),
  prazo: z.string().min(10).max(10).optional().nullable(),
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
  origem: z.enum(["reuniao_pipeline", "ad_hoc"]).default("ad_hoc"),
  tipo: z.enum(["tarefa", "acompanhamento"]).default("tarefa"),
  dependencia_id: z.string().uuid().optional().nullable(),
  dependencia_terceiro: z.boolean().default(false),
  data_reuniao: z.string().min(10).max(10).optional().nullable(),
});

export const createTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const uniqResp = Array.from(new Set(data.responsavel_ids));

    // Acompanhamento não exige prazo obrigatório
    const prazo =
      data.prazo ?? (data.tipo === "acompanhamento" ? null : new Date().toISOString().slice(0, 10));

    const insertPayload: Record<string, unknown> = {
      projeto_id: data.projeto_id,
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      responsavel_ids: uniqResp,
      criado_por_id: actorId,
      prazo,
      prioridade: data.prioridade,
      origem: data.origem,
      tipo: data.tipo ?? "tarefa",
      dependencia_id: data.dependencia_id ?? null,
      dependencia_terceiro: data.dependencia_terceiro ?? false,
      data_reuniao:
        data.origem === "reuniao_pipeline" ? data.data_reuniao ?? null : null,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Se houve observação/descrição inicial, cria como primeiro comentário
    if (data.descricao && data.descricao.trim()) {
      try {
        await supabaseAdmin.from("tarefas_comentarios").insert({
          tarefa_id: inserted.id,
          autor_id: actorId,
          conteudo: data.descricao.trim(),
        });
      } catch (err) {
        console.warn("[createTarefa] Não foi possível inserir comentário inicial:", err);
      }
    }

    await supabaseAdmin.from("atividades").insert({
      projeto_id: data.projeto_id,
      autor_id: actorId,
      acao: "criou_tarefa",
      detalhes: {
        titulo: data.titulo,
        tarefa_id: inserted.id,
        tipo: data.tipo,
      },
    });

    // Notifica todos os responsáveis exceto o próprio criador
    const destinatarios = uniqResp.filter((id) => id !== actorId);
    if (destinatarios.length > 0) {
      await enqueueNotificacaoTarefa({
        tipo: "atribuicao",
        tarefa_id: inserted.id,
        destinatarios,
      }).catch((e) => console.error("[createTarefa] notif:", e));
    }

    return { tarefa: inserted as Tarefa };
  });

export const createTarefasBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        data_reuniao: z.string().min(10).max(10),
        tarefas: z
          .array(createSchema.omit({ origem: true, data_reuniao: true }))
          .min(1)
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const rows = data.tarefas.map((t) => ({
      projeto_id: t.projeto_id,
      titulo: t.titulo,
      descricao: t.descricao ?? null,
      responsavel_ids: Array.from(new Set(t.responsavel_ids)),
      criado_por_id: actorId,
      prazo: t.prazo,
      prioridade: t.prioridade,
      origem: "reuniao_pipeline" as const,
      tipo: t.tipo ?? "tarefa",
      dependencia_id: t.dependencia_id ?? null,
      dependencia_terceiro: t.dependencia_terceiro ?? false,
      data_reuniao: data.data_reuniao,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any)
      .select("id, projeto_id, titulo, responsavel_ids, descricao");
    if (error) throw new Error(error.message);

    const ativs = (inserted ?? []).map((t) => ({
      projeto_id: t.projeto_id,
      autor_id: actorId,
      acao: "criou_tarefa",
      detalhes: {
        titulo: t.titulo,
        tarefa_id: t.id,
        origem: "reuniao_pipeline",
      },
    }));
    if (ativs.length) await supabaseAdmin.from("atividades").insert(ativs);

    for (const t of inserted ?? []) {
      if (t.descricao && t.descricao.trim()) {
        try {
          await supabaseAdmin
            .from("tarefas_comentarios")
            .insert({
              tarefa_id: t.id,
              autor_id: actorId,
              conteudo: t.descricao.trim(),
            });
        } catch {
          // fallback gracioso se migration não aplicada ainda
        }
      }

      const destinatarios = ((t.responsavel_ids ?? []) as string[]).filter(
        (id) => id !== actorId,
      );
      if (destinatarios.length > 0) {
        await enqueueNotificacaoTarefa({
          tipo: "atribuicao",
          tarefa_id: t.id,
          destinatarios,
        }).catch((e) => console.error("[createTarefasBatch] notif:", e));
      }
    }

    return { count: (inserted ?? []).length };
  });

// ---------- UPDATE ----------
const updateSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    titulo: z.string().min(1).max(300).optional(),
    descricao: z.string().max(4000).nullable().optional(),
    responsavel_ids: z.array(z.string().uuid()).min(1).max(20).optional(),
    prazo: z.string().min(10).max(10).nullable().optional(),
    status: z
      .enum(["pendente", "em_andamento", "concluida", "cancelada"])
      .optional(),
    prioridade: z.enum(["baixa", "media", "alta"]).optional(),
    projeto_id: z.string().uuid().optional(),
    origem: z.enum(["reuniao_pipeline", "ad_hoc"]).optional(),
    tipo: z.enum(["tarefa", "acompanhamento"]).optional(),
    dependencia_id: z.string().uuid().nullable().optional(),
    dependencia_terceiro: z.boolean().optional(),
    data_reuniao: z.string().min(10).max(10).nullable().optional(),
  }),
});

export const updateTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);

    const { data: before } = await supabaseAdmin
      .from("tarefas")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!before) throw new Error("Tarefa não encontrada.");

    const patch: Record<string, unknown> = { ...data.patch };
    if (patch.responsavel_ids) {
      patch.responsavel_ids = Array.from(
        new Set(patch.responsavel_ids as string[]),
      );
    }
    if (patch.status === "concluida" && before.status !== "concluida") {
      patch.concluida_em = new Date().toISOString();
    }
    if (patch.status && patch.status !== "concluida") {
      patch.concluida_em = null;
    }

    const { error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("tarefas").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);

    let acao = "editou_tarefa";
    const detalhes: Record<string, unknown> = {
      tarefa_id: data.id,
      titulo: before.titulo,
    };
    if (patch.status === "concluida" && before.status !== "concluida") {
      acao = "concluiu_tarefa";
    } else if (
      patch.projeto_id &&
      patch.projeto_id !== before.projeto_id
    ) {
      acao = "moveu_tarefa";
      detalhes.de_projeto = before.projeto_id;
      detalhes.para_projeto = patch.projeto_id;
    } else if (
      patch.responsavel_ids &&
      JSON.stringify(patch.responsavel_ids) !==
        JSON.stringify(before.responsavel_ids)
    ) {
      acao = "reatribuiu_tarefa";
      detalhes.de = before.responsavel_ids;
      detalhes.para = patch.responsavel_ids;
    }
    await supabaseAdmin.from("atividades").insert({
      projeto_id: (patch.projeto_id as string) ?? before.projeto_id,
      autor_id: actorId,
      acao,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detalhes: detalhes as any,
    });

    // Diff de responsáveis → notifica APENAS os novos
    if (patch.responsavel_ids) {
      const antes = new Set((before.responsavel_ids ?? []) as string[]);
      const novos = (patch.responsavel_ids as string[]).filter(
        (id) => !antes.has(id) && id !== actorId,
      );
      if (novos.length > 0) {
        await enqueueNotificacaoTarefa({
          tipo: "atribuicao",
          tarefa_id: data.id,
          destinatarios: novos,
        }).catch((e) => console.error("[updateTarefa] notif:", e));
      }
    }

    return { ok: true as const };
  });

export const deleteTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const { data: before } = await supabaseAdmin
      .from("tarefas")
      .select("id, projeto_id, titulo, criado_por_id")
      .eq("id", data.id)
      .single();
    if (!before) return { ok: true as const };
    const role = await getActorRole(actorId);
    if (role !== "admin" && before.criado_por_id !== actorId) {
      throw new Error("Forbidden: apenas o criador ou admin pode excluir.");
    }
    const { error } = await supabaseAdmin
      .from("tarefas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("atividades").insert({
      projeto_id: before.projeto_id,
      autor_id: actorId,
      acao: "removeu_tarefa",
      detalhes: { titulo: before.titulo },
    });
    return { ok: true as const };
  });

// ---------- CHAT DE COMENTÁRIOS DA TAREFA ----------

export const listComentariosByTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ tarefa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("tarefas_comentarios")
        .select("id, tarefa_id, autor_id, conteudo, criado_em")
        .eq("tarefa_id", data.tarefa_id)
        .order("criado_em", { ascending: true });

      if (!error && rows && rows.length > 0) {
        const authorIds = Array.from(new Set(rows.map((r) => r.autor_id)));
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, nome_completo, avatar_url")
          .in("id", authorIds);
        const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
        const comentarios: TarefaComentario[] = rows.map((r) => ({
          id: r.id,
          tarefa_id: r.tarefa_id,
          autor_id: r.autor_id,
          autor_nome: profMap.get(r.autor_id)?.nome_completo ?? "Usuário",
          autor_avatar: profMap.get(r.autor_id)?.avatar_url ?? null,
          conteudo: r.conteudo,
          criado_em: r.criado_em,
        }));
        return { comentarios };
      }
    } catch (err) {
      console.warn("[listComentariosByTarefa] Fallback para descricao legada:", err);
    }

    // Se a tabela ainda não tiver comentários, verifica se a tarefa possui descricao histórica
    const { data: tarefa } = await supabaseAdmin
      .from("tarefas")
      .select("id, descricao, criado_por_id, created_at")
      .eq("id", data.tarefa_id)
      .single();

    if (tarefa?.descricao && tarefa.descricao.trim()) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("nome_completo, avatar_url")
        .eq("id", tarefa.criado_por_id)
        .single();
      return {
        comentarios: [
          {
            id: `legacy-${tarefa.id}`,
            tarefa_id: tarefa.id,
            autor_id: tarefa.criado_por_id,
            autor_nome: prof?.nome_completo ?? "Observação original",
            autor_avatar: prof?.avatar_url ?? null,
            conteudo: tarefa.descricao,
            criado_em: tarefa.created_at,
          },
        ] as TarefaComentario[],
      };
    }

    return { comentarios: [] as TarefaComentario[] };
  });

export const createComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        tarefa_id: z.string().uuid(),
        conteudo: z.string().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);

    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas_comentarios")
      .insert({
        tarefa_id: data.tarefa_id,
        autor_id: actorId,
        conteudo: data.conteudo.trim(),
      })
      .select("*")
      .single();

    if (error) {
      // Fallback: se a tabela ainda não tiver sido criada, preserva no campo descricao
      const { data: t } = await supabaseAdmin
        .from("tarefas")
        .select("descricao, projeto_id")
        .eq("id", data.tarefa_id)
        .single();
      const newDesc = t?.descricao
        ? `${t.descricao}\n---\n${data.conteudo.trim()}`
        : data.conteudo.trim();
      await supabaseAdmin
        .from("tarefas")
        .update({ descricao: newDesc, updated_at: new Date().toISOString() })
        .eq("id", data.tarefa_id);
    } else {
      await supabaseAdmin
        .from("tarefas")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.tarefa_id);
    }

    return { ok: true, comentario: inserted };
  });

// ---------- SUBTAREFAS (CHECKLIST) ----------

export const listSubtarefasByTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ tarefa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("tarefas_subtarefas")
        .select("*")
        .eq("tarefa_id", data.tarefa_id)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: true });
      if (error) return { subtarefas: [] as TarefaSubtarefa[] };
      return { subtarefas: (rows ?? []) as TarefaSubtarefa[] };
    } catch {
      return { subtarefas: [] as TarefaSubtarefa[] };
    }
  });

export const createSubtarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        tarefa_id: z.string().uuid(),
        titulo: z.string().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);

    const { data: last } = await supabaseAdmin
      .from("tarefas_subtarefas")
      .select("ordem")
      .eq("tarefa_id", data.tarefa_id)
      .order("ordem", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (last?.ordem ?? 0) + 1;
    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas_subtarefas")
      .insert({
        tarefa_id: data.tarefa_id,
        titulo: data.titulo.trim(),
        criado_por_id: actorId,
        ordem: nextOrder,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { subtarefa: inserted as TarefaSubtarefa };
  });

export const toggleSubtarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid(),
        concluida: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertNotObservador(context.userId);
    const { data: updated, error } = await supabaseAdmin
      .from("tarefas_subtarefas")
      .update({
        concluida: data.concluida,
        concluida_em: data.concluida ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { subtarefa: updated as TarefaSubtarefa };
  });

export const deleteSubtarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertNotObservador(context.userId);
    const { error } = await supabaseAdmin
      .from("tarefas_subtarefas")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
