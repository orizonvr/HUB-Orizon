import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamMember = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  email: string;
  avatar_url: string | null;
  role: "admin" | "lider" | "analista" | "observador";
  ativo: boolean;
  status_convite: "pendente" | "ativo";
  projetos_responsavel: number;
  projetos_lider: number;
  ultima_atividade: string | null;
};

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

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ members: TeamMember[] }> => {
    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    const isAdmin = actor?.role === "admin";

    let profilesQuery = supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, cargo, email, avatar_url, role, ativo, status_convite")
      .order("nome_completo");
    if (!isAdmin) {
      profilesQuery = profilesQuery.or(`ativo.eq.true,id.eq.${context.userId}`);
    }

    const [{ data: profs, error: pErr }, { data: projetos }, { data: ativs }] = await Promise.all([
      profilesQuery,
      supabaseAdmin.from("projetos").select("responsavel_id, lider_id"),
      supabaseAdmin.from("atividades").select("autor_id, criado_em").order("criado_em", { ascending: false }),
    ]);
    if (pErr) throw new Error(pErr.message);

    const respCount = new Map<string, number>();
    const liderCount = new Map<string, number>();
    for (const p of projetos ?? []) {
      if (p.responsavel_id) respCount.set(p.responsavel_id as string, (respCount.get(p.responsavel_id as string) ?? 0) + 1);
      if (p.lider_id) liderCount.set(p.lider_id as string, (liderCount.get(p.lider_id as string) ?? 0) + 1);
    }
    const lastByUser = new Map<string, string>();
    for (const a of ativs ?? []) {
      if (a.autor_id && !lastByUser.has(a.autor_id as string)) {
        lastByUser.set(a.autor_id as string, a.criado_em as string);
      }
    }

    const members: TeamMember[] = (profs ?? []).map((p) => ({
      id: p.id as string,
      nome_completo: p.nome_completo as string,
      cargo: (p.cargo as string | null) ?? null,
      email: p.email as string,
      avatar_url: (p.avatar_url as string | null) ?? null,
      role: p.role as TeamMember["role"],
      ativo: Boolean(p.ativo),
      status_convite: ((p as { status_convite?: string }).status_convite as TeamMember["status_convite"]) ?? "ativo",
      projetos_responsavel: respCount.get(p.id as string) ?? 0,
      projetos_lider: liderCount.get(p.id as string) ?? 0,
      ultima_atividade: lastByUser.get(p.id as string) ?? null,
    }));

    return { members };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        role: z.enum(["admin", "lider", "analista", "observador"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // impede que o último admin seja rebaixado
    if (data.role !== "admin") {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", data.id)
        .single();
      if (target?.role === "admin") {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("ativo", true);
        if ((count ?? 0) <= 1) {
          throw new Error("Não é possível rebaixar o último administrador ativo.");
        }
      }
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
