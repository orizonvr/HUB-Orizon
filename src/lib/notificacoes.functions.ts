import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Notificacao } from "./notificacoes-types";

export const listNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().min(1).max(100).default(10) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("notificacoes")
      .select("*")
      .eq("usuario_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { notificacoes: (rows ?? []) as Notificacao[] };
  });

export const listAllNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().min(0).default(0),
        pageSize: z.number().min(1).max(100).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, error, count } = await supabaseAdmin
      .from("notificacoes")
      .select("*", { count: "exact" })
      .eq("usuario_id", context.userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return {
      notificacoes: (rows ?? []) as Notificacao[],
      total: count ?? 0,
    };
  });

export const contarNaoLidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", context.userId)
      .eq("lida", false);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const marcarComoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", data.id)
      .eq("usuario_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const marcarTodasComoLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("notificacoes")
      .update({ lida: true })
      .eq("usuario_id", context.userId)
      .eq("lida", false);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
