// TEMPORÁRIO — Importação one-shot das tarefas históricas do Planner.
// Apagar este arquivo + a rota /admin-import após confirmar a importação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import csvText from "./import-planner-data.csv?raw";

// ---------------- CSV parser (RFC-4180 simples, suporta aspas + vírgulas) ----------------
type Row = Record<string, string>;
function parseCsv(text: string): Row[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (field.length > 0 || cur.length > 0) {
          cur.push(field);
          lines.push(cur);
          cur = [];
          field = "";
        }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    lines.push(cur);
  }
  const [header, ...rest] = lines;
  return rest.map((cols) => {
    const r: Row = {};
    header.forEach((h, idx) => (r[h] = (cols[idx] ?? "").trim()));
    return r;
  });
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const FALLBACK_CRIADOR_EMAIL = "renan.dipardi@orizonvr.com.br";

async function assertAdmin(supabase: {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => { single: () => Promise<{ data: { role?: string } | null }> };
    };
  };
}, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!data || data.role !== "admin") {
    throw new Error("Forbidden: apenas admin pode rodar a importação.");
  }
}

// ============================ ETAPA 1 — DIAGNÓSTICO ============================
export const diagnosticarImportacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(
      context.supabase as unknown as Parameters<typeof assertAdmin>[0],
      context.userId,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = parseCsv(csvText);

    // 1) count atual
    const { count: countAtual } = await supabaseAdmin
      .from("tarefas")
      .select("*", { count: "exact", head: true });

    // 2) enums (via types.ts — refletem o schema atual)
    const enums = {
      tarefa_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      tarefa_prioridade: ["baixa", "media", "alta"],
      tarefa_origem: ["reuniao_pipeline", "ad_hoc"],
      projeto_tipo: ["ma", "novos_negocios"],
      projeto_status: ["ativo", "pausado", "concluido", "arquivado", "perdido"],
    };

    // 3) projetos
    const { data: projetos } = await supabaseAdmin
      .from("projetos")
      .select("id, nome, tipo")
      .order("nome");
    const projetosArr = (projetos ?? []) as Array<{
      id: string;
      nome: string;
      tipo: string;
    }>;

    // 4) profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nome_completo")
      .order("nome_completo");
    const profilesArr = (profiles ?? []) as Array<{
      id: string;
      email: string;
      nome_completo: string;
    }>;
    const emailToProfile = new Map(
      profilesArr.map((p) => [p.email.toLowerCase(), p]),
    );

    // 5) matching de buckets
    const projByNorm = new Map(projetosArr.map((p) => [norm(p.nome), p]));
    const buckets = Array.from(
      new Set(rows.map((r) => r.projeto_planner).filter(Boolean)),
    );

    const matchExato: Array<{ bucket: string; projeto_id: string; projeto_nome: string }> = [];
    const matchFuzzy: Array<{
      bucket: string;
      projeto_id: string;
      projeto_nome: string;
      como: string;
    }> = [];
    const semMatch: Array<{
      bucket: string;
      tarefas: number;
      primeiras_datas: string[];
      criador_mais_freq: string;
    }> = [];

    for (const b of buckets) {
      const n = norm(b);
      const exato = projByNorm.get(n);
      if (exato) {
        matchExato.push({ bucket: b, projeto_id: exato.id, projeto_nome: exato.nome });
        continue;
      }
      // fuzzy: substring nos dois sentidos
      const candidato = projetosArr.find(
        (p) => norm(p.nome).includes(n) || n.includes(norm(p.nome)),
      );
      if (candidato) {
        matchFuzzy.push({
          bucket: b,
          projeto_id: candidato.id,
          projeto_nome: candidato.nome,
          como: `"${b}" ⇔ "${candidato.nome}"`,
        });
        continue;
      }
      const tarefasDoBucket = rows.filter((r) => r.projeto_planner === b);
      const criadoresFreq = new Map<string, number>();
      for (const t of tarefasDoBucket) {
        const k = t.criado_por_email || "(vazio)";
        criadoresFreq.set(k, (criadoresFreq.get(k) ?? 0) + 1);
      }
      const criadorMaisFreq = Array.from(criadoresFreq.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] ?? "(vazio)";
      semMatch.push({
        bucket: b,
        tarefas: tarefasDoBucket.length,
        primeiras_datas: tarefasDoBucket
          .map((t) => t.criado_em)
          .filter(Boolean)
          .slice(0, 3),
        criador_mais_freq: criadorMaisFreq,
      });
    }

    // 6) emails sem profile
    const emailsCsv = new Set<string>();
    for (const r of rows) {
      for (const f of ["responsavel_email", "criado_por_email", "concluida_por_email"]) {
        if (r[f]) emailsCsv.add(r[f].toLowerCase());
      }
    }
    const emailsSemProfile = Array.from(emailsCsv).filter(
      (e) => !emailToProfile.has(e),
    );

    // 7) contagem por bucket
    const porBucket: Record<string, number> = {};
    for (const r of rows) porBucket[r.projeto_planner] = (porBucket[r.projeto_planner] ?? 0) + 1;

    // 8) tarefas sem prazo
    const semPrazo = rows.filter((r) => !r.data_vencimento).length;

    // 9) status / prioridade brutos
    const porStatus: Record<string, number> = {};
    const porPrioridade: Record<string, number> = {};
    for (const r of rows) {
      porStatus[r.status] = (porStatus[r.status] ?? 0) + 1;
      porPrioridade[r.prioridade] = (porPrioridade[r.prioridade] ?? 0) + 1;
    }

    return {
      total_linhas_csv: rows.length,
      count_atual_tarefas: countAtual ?? 0,
      pode_prosseguir: (countAtual ?? 0) === 0,
      enums,
      decisao_prazo: "OPCAO_B (sem migration disponível): prazo vazio recebe concluida_em → criado_em",
      decisao_criador_fallback: FALLBACK_CRIADOR_EMAIL,
      por_status: porStatus,
      por_prioridade: porPrioridade,
      por_bucket: porBucket,
      tarefas_sem_prazo_no_csv: semPrazo,
      match_exato: matchExato,
      match_fuzzy: matchFuzzy,
      sem_match: semMatch,
      emails_sem_profile: emailsSemProfile,
      profiles_existentes: profilesArr.map((p) => ({
        id: p.id,
        email: p.email,
        nome: p.nome_completo,
      })),
    };
  });

// ============================ ETAPA 2 — IMPORTAÇÃO ============================
const importSchema = z.object({
  // bucketNormalizado → projeto_id existente OU "NOVO" (cria via novos_projetos) OU "PULAR"
  mapeamento: z.record(z.string(), z.string()),
  novos_projetos: z
    .array(
      z.object({
        bucket: z.string(),
        nome: z.string(),
        tipo: z.enum(["ma", "novos_negocios"]),
        status: z.enum(["ativo", "pausado", "concluido", "arquivado", "perdido"]),
      }),
    )
    .default([]),
  // confirmação explícita pra evitar invocação acidental
  confirmar: z.literal("IMPORTAR_AGORA"),
});

export const importarTarefasPlanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(
      context.supabase as unknown as Parameters<typeof assertAdmin>[0],
      context.userId,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Safety: bloqueia se já houver tarefas
    const { count: countAtual } = await supabaseAdmin
      .from("tarefas")
      .select("*", { count: "exact", head: true });
    if ((countAtual ?? 0) > 0) {
      throw new Error(
        `Tabela tarefas não está vazia (count=${countAtual}). Importação abortada.`,
      );
    }

    const rows = parseCsv(csvText);

    // resolvedores
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email");
    const emailToId = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string }>).map((p) => [
        p.email.toLowerCase(),
        p.id,
      ]),
    );
    const fallbackCriadorId = emailToId.get(FALLBACK_CRIADOR_EMAIL);
    if (!fallbackCriadorId) {
      throw new Error(
        `Profile fallback (${FALLBACK_CRIADOR_EMAIL}) não existe. Crie antes de importar.`,
      );
    }

    // 1) criar projetos novos (atômico — uma única INSERT statement)
    const projetoIdPorBucket = new Map<string, string>();
    const projetosCriadosIds: string[] = [];
    if (data.novos_projetos.length > 0) {
      const rowsProj = data.novos_projetos.map((p) => ({
        nome: p.nome,
        tipo: p.tipo,
        status: p.status,
        responsavel_id: fallbackCriadorId,
        criado_por_id: fallbackCriadorId,
      }));
      const { data: criados, error: errProj } = await supabaseAdmin
        .from("projetos")
        .insert(rowsProj as never)
        .select("id, nome");
      if (errProj) throw new Error(`Falha ao criar projetos: ${errProj.message}`);
      const byNome = new Map(
        ((criados ?? []) as Array<{ id: string; nome: string }>).map((p) => [
          p.nome,
          p.id,
        ]),
      );
      for (const np of data.novos_projetos) {
        const id = byNome.get(np.nome);
        if (!id) throw new Error(`Projeto criado mas não retornou id: ${np.nome}`);
        projetoIdPorBucket.set(norm(np.bucket), id);
        projetosCriadosIds.push(id);
      }
    }

    // 2) montar linhas de tarefas
    const STATUS_MAP: Record<string, string> = {
      nao_iniciada: "pendente",
      em_andamento: "em_andamento",
      concluida: "concluida",
      cancelada: "cancelada",
    };
    const PRIO_MAP: Record<string, string> = {
      baixa: "baixa",
      media: "media",
      alta: "alta",
      urgente: "alta",
    };

    const puladas: string[] = [];
    const tarefasInsert: Array<Record<string, unknown>> = [];
    let semResponsavel = 0;
    let comFallbackCriador = 0;

    for (const r of rows) {
      const bn = norm(r.projeto_planner);
      const destino =
        data.mapeamento[bn] ?? projetoIdPorBucket.get(bn) ?? null;
      if (!destino || destino === "PULAR") {
        puladas.push(`${r.projeto_planner} | ${r.titulo}`);
        continue;
      }
      const projetoId =
        destino === "NOVO" ? projetoIdPorBucket.get(bn) : destino;
      if (!projetoId) {
        puladas.push(`${r.projeto_planner} | ${r.titulo} (sem projeto resolvido)`);
        continue;
      }

      const status = STATUS_MAP[r.status] ?? "pendente";
      const prioridadeOriginal = r.prioridade;
      const prioridade = PRIO_MAP[r.prioridade] ?? "media";

      // prazo fallback (opção B): vazio → concluida_em → criado_em
      const prazo = r.data_vencimento || r.concluida_em || r.criado_em;
      if (!prazo) {
        puladas.push(`${r.projeto_planner} | ${r.titulo} (sem nenhuma data)`);
        continue;
      }

      // responsável
      const respId = r.responsavel_email
        ? emailToId.get(r.responsavel_email.toLowerCase())
        : undefined;
      const responsavelIds = respId ? [respId] : [];
      if (responsavelIds.length === 0) semResponsavel++;

      // criador
      let criadorId = r.criado_por_email
        ? emailToId.get(r.criado_por_email.toLowerCase())
        : undefined;
      if (!criadorId) {
        criadorId = fallbackCriadorId;
        comFallbackCriador++;
      }

      // descrição enriquecida
      const partes: string[] = [];
      if (prioridadeOriginal === "urgente") {
        partes.push("[Prioridade original: urgente]");
      }
      if (r.notas) partes.push(r.notas);
      if (
        r.concluida_por_email &&
        r.concluida_por_email.toLowerCase() !== (r.responsavel_email ?? "").toLowerCase()
      ) {
        partes.push(`[Concluída por: ${r.concluida_por_email}]`);
      }
      const descricao = partes.length > 0 ? partes.join(" | ") : null;

      const concluidaEm = r.concluida_em
        ? new Date(r.concluida_em + "T00:00:00Z").toISOString()
        : null;
      const createdAt = r.criado_em
        ? new Date(r.criado_em + "T00:00:00Z").toISOString()
        : new Date().toISOString();

      tarefasInsert.push({
        projeto_id: projetoId,
        titulo: r.titulo,
        descricao,
        responsavel_ids: responsavelIds,
        criado_por_id: criadorId,
        prazo,
        status,
        prioridade,
        origem: "ad_hoc",
        data_reuniao: null,
        concluida_em: concluidaEm,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    // 3) insert único e atômico
    if (tarefasInsert.length === 0) {
      // rollback dos projetos criados (nenhuma tarefa pra justificar)
      if (projetosCriadosIds.length > 0) {
        await supabaseAdmin.from("projetos").delete().in("id", projetosCriadosIds);
      }
      return {
        ok: false,
        razao: "Nenhuma tarefa para inserir",
        puladas: puladas.length,
      };
    }

    const { error: errIns, count: insertedCount } = await supabaseAdmin
      .from("tarefas")
      .insert(tarefasInsert as never, { count: "exact" });

    if (errIns) {
      // rollback dos projetos criados
      if (projetosCriadosIds.length > 0) {
        await supabaseAdmin.from("projetos").delete().in("id", projetosCriadosIds);
      }
      throw new Error(`Falha no insert de tarefas (rollback feito): ${errIns.message}`);
    }

    // 4) contagem real depois
    const { count: countDepois } = await supabaseAdmin
      .from("tarefas")
      .select("*", { count: "exact", head: true });

    // breakdown
    const breakdown = { pendente: 0, em_andamento: 0, concluida: 0, cancelada: 0 };
    for (const t of tarefasInsert) {
      const s = t.status as keyof typeof breakdown;
      breakdown[s] = (breakdown[s] ?? 0) + 1;
    }

    return {
      ok: true,
      count_antes: countAtual ?? 0,
      count_depois: countDepois ?? 0,
      tarefas_inseridas: insertedCount ?? tarefasInsert.length,
      projetos_criados: projetosCriadosIds.length,
      puladas: puladas.length,
      tarefas_puladas_lista: puladas.slice(0, 50),
      sem_responsavel: semResponsavel,
      com_criador_fallback: comFallbackCriador,
      breakdown_por_status: breakdown,
    };
  });
