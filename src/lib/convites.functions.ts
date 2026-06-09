import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["admin", "lider", "analista", "observador"] as const;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!data || data.role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}

export type ConviteInfo = {
  token: string;
  expira_em: string;
  profile_id: string;
};

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        nome_completo: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        cargo: z.string().trim().min(1).max(120),
        role: z.enum(ROLES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ConviteInfo> => {
    await assertAdmin(context.userId);
    const email = data.email.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, status_convite")
      .ilike("email", email)
      .maybeSingle();

    if (existing && existing.status_convite === "ativo") {
      throw new Error("Já existe um usuário ativo com este e-mail.");
    }

    let profileId = existing?.id as string | undefined;
    if (!profileId) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from("profiles")
        .insert({
          nome_completo: data.nome_completo,
          email,
          cargo: data.cargo,
          role: data.role,
          ativo: true,
          status_convite: "pendente",
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      profileId = created.id as string;
    } else {
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({
          nome_completo: data.nome_completo,
          cargo: data.cargo,
          role: data.role,
          status_convite: "pendente",
        })
        .eq("id", profileId);
      if (upErr) throw new Error(upErr.message);
    }

    // expira convites anteriores
    await supabaseAdmin
      .from("convites")
      .update({ expira_em: new Date(Date.now() - 1000).toISOString() })
      .eq("profile_id", profileId)
      .is("usado_em", null);

    const { data: conv, error: cErr } = await supabaseAdmin
      .from("convites")
      .insert({
        profile_id: profileId,
        criado_por: context.userId,
      })
      .select("token, expira_em, profile_id")
      .single();
    if (cErr) throw new Error(cErr.message);

    return {
      token: conv.token as string,
      expira_em: conv.expira_em as string,
      profile_id: conv.profile_id as string,
    };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ profile_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ConviteInfo> => {
    await assertAdmin(context.userId);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, status_convite")
      .eq("id", data.profile_id)
      .single();
    if (!prof || prof.status_convite !== "pendente") {
      throw new Error("Apenas convites pendentes podem ser reenviados.");
    }

    await supabaseAdmin
      .from("convites")
      .update({ expira_em: new Date(Date.now() - 1000).toISOString() })
      .eq("profile_id", data.profile_id)
      .is("usado_em", null);

    const { data: conv, error } = await supabaseAdmin
      .from("convites")
      .insert({ profile_id: data.profile_id, criado_por: context.userId })
      .select("token, expira_em, profile_id")
      .single();
    if (error) throw new Error(error.message);

    return {
      token: conv.token as string,
      expira_em: conv.expira_em as string,
      profile_id: conv.profile_id as string,
    };
  });

export const getCurrentInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ profile_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ConviteInfo> => {
    await assertAdmin(context.userId);
    const { data: conv } = await supabaseAdmin
      .from("convites")
      .select("token, expira_em, profile_id")
      .eq("profile_id", data.profile_id)
      .is("usado_em", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv && new Date(conv.expira_em as string).getTime() > Date.now()) {
      return {
        token: conv.token as string,
        expira_em: conv.expira_em as string,
        profile_id: conv.profile_id as string,
      };
    }

    // expirado ou inexistente → gera novo
    if (conv) {
      await supabaseAdmin
        .from("convites")
        .update({ expira_em: new Date(Date.now() - 1000).toISOString() })
        .eq("profile_id", data.profile_id)
        .is("usado_em", null);
    }
    const { data: novo, error } = await supabaseAdmin
      .from("convites")
      .insert({ profile_id: data.profile_id, criado_por: context.userId })
      .select("token, expira_em, profile_id")
      .single();
    if (error) throw new Error(error.message);
    return {
      token: novo.token as string,
      expira_em: novo.expira_em as string,
      profile_id: novo.profile_id as string,
    };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ profile_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("status_convite")
      .eq("id", data.profile_id)
      .single();
    if (!prof || prof.status_convite !== "pendente") {
      throw new Error("Apenas convites pendentes podem ser cancelados.");
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Tela pública /aceitar-convite — sem auth
export type InvitePreview = {
  valid: boolean;
  reason?: "expirado" | "usado" | "inexistente";
  nome_completo?: string;
  email?: string;
  cargo?: string | null;
};

export const previewInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InvitePreview> => {
    const { data: conv } = await supabaseAdmin
      .from("convites")
      .select("expira_em, usado_em, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!conv) return { valid: false, reason: "inexistente" };
    if (conv.usado_em) return { valid: false, reason: "usado" };
    if (new Date(conv.expira_em as string).getTime() < Date.now())
      return { valid: false, reason: "expirado" };

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("nome_completo, email, cargo")
      .eq("id", conv.profile_id as string)
      .single();
    return {
      valid: true,
      nome_completo: prof?.nome_completo as string,
      email: prof?.email as string,
      cargo: (prof?.cargo as string | null) ?? null,
    };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().uuid(),
        password: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ email: string }> => {
    const { data: conv } = await supabaseAdmin
      .from("convites")
      .select("id, expira_em, usado_em, profile_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!conv) throw new Error("Convite inválido.");
    if (conv.usado_em) throw new Error("Este convite já foi usado.");
    if (new Date(conv.expira_em as string).getTime() < Date.now())
      throw new Error("Este convite expirou.");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, nome_completo, cargo")
      .eq("id", conv.profile_id as string)
      .single();
    if (!prof) throw new Error("Perfil do convite não encontrado.");

    const email = prof.email as string;

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: prof.nome_completo,
        cargo: prof.cargo,
      },
    });
    if (cErr) throw new Error(cErr.message);

    // O trigger handle_new_user já vincula o profile e marca convite como usado.
    // Garantia extra:
    await supabaseAdmin
      .from("convites")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", conv.id as string)
      .is("usado_em", null);

    if (created.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ status_convite: "ativo", ativo: true })
        .eq("id", created.user.id);
    }

    return { email };
  });
