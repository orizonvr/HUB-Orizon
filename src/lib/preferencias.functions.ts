import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PREFERENCIAS,
  normalizePreferencias,
  type PreferenciasNotificacao,
} from "./notificacoes-types";

export const getPreferencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("preferencias")
      .eq("id", context.userId)
      .single();
    const raw = (data as { preferencias?: unknown } | null)?.preferencias;
    const prefs: PreferenciasNotificacao = normalizePreferencias(raw);
    return { preferencias: prefs };
  });

export const updatePreferencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email_notificacoes: z.boolean().optional(),
        view_tarefas_modo: z.enum(["tabela", "cards", "kanban"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: cur } = await supabaseAdmin
      .from("profiles")
      .select("preferencias")
      .eq("id", context.userId)
      .single();
    const rawCur = (cur as { preferencias?: unknown } | null)?.preferencias;
    const merged: PreferenciasNotificacao = {
      ...normalizePreferencias(rawCur),
      ...data,
    };
    const { error } = await supabaseAdmin
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ preferencias: merged as any })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { preferencias: merged };
  });

