import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocumentoRow = {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
  url_storage: string;
  projeto_id: string;
  projeto_nome: string;
  projeto_tipo: "ma" | "novos_negocios";
  enviado_por: string;
  enviado_por_nome: string;
};

export const listAllDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ documentos: DocumentoRow[] }> => {
    const [docs, projs, profs] = await Promise.all([
      supabaseAdmin
        .from("documentos")
        .select("id, nome, tipo, tamanho_bytes, criado_em, url_storage, projeto_id, enviado_por")
        .order("criado_em", { ascending: false }),
      supabaseAdmin.from("projetos").select("id, nome, tipo"),
      supabaseAdmin.from("profiles").select("id, nome_completo"),
    ]);
    if (docs.error) throw new Error(docs.error.message);
    const projMap = new Map(
      (projs.data ?? []).map((p) => [p.id as string, { nome: p.nome as string, tipo: p.tipo as string }]),
    );
    const profMap = new Map(
      (profs.data ?? []).map((p) => [p.id as string, p.nome_completo as string]),
    );
    const documentos: DocumentoRow[] = (docs.data ?? []).map((d) => {
      const proj = projMap.get(d.projeto_id as string);
      return {
        id: d.id as string,
        nome: d.nome as string,
        tipo: (d.tipo as string | null) ?? null,
        tamanho_bytes: (d.tamanho_bytes as number | null) ?? null,
        criado_em: d.criado_em as string,
        url_storage: d.url_storage as string,
        projeto_id: d.projeto_id as string,
        projeto_nome: proj?.nome ?? "—",
        projeto_tipo: (proj?.tipo ?? "ma") as "ma" | "novos_negocios",
        enviado_por: d.enviado_por as string,
        enviado_por_nome: profMap.get(d.enviado_por as string) ?? "—",
      };
    });
    return { documentos };
  });
