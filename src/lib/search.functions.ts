import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchResult =
  | { kind: "projeto"; id: string; title: string; subtitle: string; tipo: "ma" | "novos_negocios" }
  | { kind: "comentario"; id: string; projeto_id: string; title: string; subtitle: string }
  | { kind: "documento"; id: string; projeto_id: string; title: string; subtitle: string }
  | { kind: "profile"; id: string; title: string; subtitle: string };

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ q: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim();
    const like = `%${q.replace(/[%_]/g, "")}%`;

    const [projs, coms, docs, profs] = await Promise.all([
      supabaseAdmin
        .from("projetos")
        .select("id, nome, contraparte, tese, tipo, estagio")
        .or(`nome.ilike.${like},contraparte.ilike.${like},tese.ilike.${like}`)
        .limit(8),
      supabaseAdmin
        .from("comentarios")
        .select("id, projeto_id, conteudo, criado_em")
        .ilike("conteudo", like)
        .order("criado_em", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("documentos")
        .select("id, projeto_id, nome, tipo")
        .ilike("nome", like)
        .limit(6),
      supabaseAdmin
        .from("profiles")
        .select("id, nome_completo, cargo, email")
        .or(`nome_completo.ilike.${like},email.ilike.${like},cargo.ilike.${like}`)
        .eq("ativo", true)
        .limit(6),
    ]);

    // Build a project name map for context on comentarios/documentos
    const projetoIds = new Set<string>();
    (coms.data ?? []).forEach((c) => projetoIds.add(c.projeto_id as string));
    (docs.data ?? []).forEach((d) => projetoIds.add(d.projeto_id as string));
    let nameMap = new Map<string, { nome: string; tipo: string }>();
    if (projetoIds.size > 0) {
      const { data: pdata } = await supabaseAdmin
        .from("projetos")
        .select("id, nome, tipo")
        .in("id", Array.from(projetoIds));
      nameMap = new Map(
        (pdata ?? []).map((p) => [
          p.id as string,
          { nome: p.nome as string, tipo: p.tipo as string },
        ]),
      );
    }

    const results: SearchResult[] = [];
    for (const p of projs.data ?? []) {
      results.push({
        kind: "projeto",
        id: p.id as string,
        title: p.nome as string,
        subtitle: `${(p.contraparte as string) ?? "—"} · ${(p.estagio as string) ?? ""}`,
        tipo: p.tipo as "ma" | "novos_negocios",
      });
    }
    for (const c of coms.data ?? []) {
      const proj = nameMap.get(c.projeto_id as string);
      results.push({
        kind: "comentario",
        id: c.id as string,
        projeto_id: c.projeto_id as string,
        title: String(c.conteudo).slice(0, 80),
        subtitle: proj ? `em ${proj.nome}` : "em projeto",
      });
    }
    for (const d of docs.data ?? []) {
      const proj = nameMap.get(d.projeto_id as string);
      results.push({
        kind: "documento",
        id: d.id as string,
        projeto_id: d.projeto_id as string,
        title: d.nome as string,
        subtitle: `${(d.tipo as string) ?? "Documento"} · ${proj?.nome ?? "—"}`,
      });
    }
    for (const u of profs.data ?? []) {
      results.push({
        kind: "profile",
        id: u.id as string,
        title: u.nome_completo as string,
        subtitle: `${(u.cargo as string) ?? "—"} · ${u.email as string}`,
      });
    }

    return { results };
  });
