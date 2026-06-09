import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  nome_completo: z.string().min(1).max(120),
  cargo: z.string().min(1).max(120),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        nome_completo: data.nome_completo,
        cargo: data.cargo,
        avatar_url: data.avatar_url ?? null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
