import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Tarefa,
  TarefaComContexto,
  ResponsavelLite,
} from "./tarefas-types";
import { enqueueNotificacaoTarefa } from "./notificacoes.server";

export type { Tarefa, TarefaComContexto } from "./tarefas-types";

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
  const [projs, profs] = await Promise.all([
    supabaseAdmin.from("projetos").select("id, nome, tipo").in("id", projIds),
    respIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id, nome_completo, avatar_url")
          .in("id", respIds)
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
  return rows.map((t) => {
    const responsaveis: ResponsavelLite[] = (t.responsavel_ids ?? [])
      .map((id) => {
        const u = uMap.get(id);
        return u
          ? { id: u.id, nome: u.nome_completo, avatar_url: u.avatar_url }
          : { id, nome: "—", avatar_url: null };
      });
    return {
      ...t,
      projeto_nome: pMap.get(t.projeto_id)?.nome ?? "—",
      projeto_tipo: pMap.get(t.projeto_id)?.tipo ?? "ma",
      responsaveis,
    };
  });
}

// ---------- GET ONE ----------
export const getTarefaById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
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
  .inputValidator((d) => z.object({ projeto_id: z.string().uuid() }).parse(d))
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
  .inputValidator((d) =>
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
      .select("responsavel_ids, prazo, status")
      .in("status", ["pendente", "em_andamento"]);
    if (error) throw new Error(error.message);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<
      string,
      { vencidas: number; em_3_dias: number; proximas: number; total: number }
    >();
    for (const r of rows ?? []) {
      const prazo = new Date(r.prazo + "T00:00:00");
      const diff = Math.round(
        (prazo.getTime() - today.getTime()) / 86_400_000,
      );
      // Conta uma vez para CADA responsável (tarefas compartilhadas
      // entram na linha de todo mundo).
      for (const respId of (r.responsavel_ids ?? []) as string[]) {
        const cur = map.get(respId) ?? {
          vencidas: 0,
          em_3_dias: 0,
          proximas: 0,
          total: 0,
        };
        cur.total += 1;
        if (diff < 0) cur.vencidas += 1;
        else if (diff <= 3) cur.em_3_dias += 1;
        else cur.proximas += 1;
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
      .select("id")
      .contains("responsavel_ids", [context.userId])
      .in("status", ["pendente", "em_andamento"])
      .lte("prazo", limiteStr);
    return { count: (rows ?? []).length };
  });

// ---------- CREATE ----------
const createSchema = z.object({
  projeto_id: z.string().uuid(),
  titulo: z.string().min(1).max(300),
  descricao: z.string().max(4000).optional().nullable(),
  responsavel_ids: z.array(z.string().uuid()).min(1).max(20),
  prazo: z.string().min(10).max(10),
  prioridade: z.enum(["baixa", "media", "alta"]).default("media"),
  origem: z.enum(["reuniao_pipeline", "ad_hoc"]).default("ad_hoc"),
  data_reuniao: z.string().min(10).max(10).optional().nullable(),
});

export const createTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);
    const uniqResp = Array.from(new Set(data.responsavel_ids));
    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas")
      .insert({
        projeto_id: data.projeto_id,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        responsavel_ids: uniqResp,
        criado_por_id: actorId,
        prazo: data.prazo,
        prioridade: data.prioridade,
        origem: data.origem,
        data_reuniao:
          data.origem === "reuniao_pipeline" ? data.data_reuniao ?? null : null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("atividades").insert({
      projeto_id: data.projeto_id,
      autor_id: actorId,
      acao: "criou_tarefa",
      detalhes: { titulo: data.titulo, tarefa_id: inserted.id },
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
  .inputValidator((d) =>
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
      data_reuniao: data.data_reuniao,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("tarefas")
      .insert(rows)
      .select("id, projeto_id, titulo, responsavel_ids");
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
    prazo: z.string().min(10).max(10).optional(),
    status: z
      .enum(["pendente", "em_andamento", "concluida", "cancelada"])
      .optional(),
    prioridade: z.enum(["baixa", "media", "alta"]).optional(),
    projeto_id: z.string().uuid().optional(),
    origem: z.enum(["reuniao_pipeline", "ad_hoc"]).optional(),
    data_reuniao: z.string().min(10).max(10).nullable().optional(),
  }),
});

export const updateTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertNotObservador(actorId);

    const { data: before } = await supabaseAdmin
      .from("tarefas")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!before) throw new Error("Tarefa não encontrada.");

    const role = await getActorRole(actorId);
    const isOwner =
      before.criado_por_id === actorId ||
      ((before.responsavel_ids ?? []) as string[]).includes(actorId);
    if (role !== "admin" && !isOwner) {
      throw new Error(
        "Forbidden: apenas criador, responsável ou admin pode editar.",
      );
    }

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
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
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
