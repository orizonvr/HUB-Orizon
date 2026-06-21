// One-shot importer: lê .xlsx cru exportado do MS Planner.
// Apagar este arquivo + o dialog + o botão depois de confirmar a importação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Row = Record<string, string>;

function norm(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS_MAP: Record<string, "pendente" | "em_andamento" | "concluida"> = {
  "nao iniciado": "pendente",
  "nao iniciada": "pendente",
  "em andamento": "em_andamento",
  concluida: "concluida",
  concluido: "concluida",
};
const PRIO_MAP: Record<string, "baixa" | "media" | "alta"> = {
  baixa: "baixa",
  media: "media",
  importante: "alta",
  urgente: "alta",
  alta: "alta",
};

function get(row: Row, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => norm(rk) === norm(k));
    if (found && row[found] != null && String(row[found]).trim() !== "")
      return String(row[found]).trim();
  }
  return "";
}

function splitPessoas(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function toIsoDate(s: string): string | null {
  // accepts "YYYY-MM-DD", "DD/MM/YYYY", or full ISO datetime
  if (!s) return null;
  const t = s.trim();
  // DD/MM/YYYY
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // fallback Date parse
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
}

function toIsoTimestamp(s: string): string | null {
  if (!s) return null;
  const date = toIsoDate(s);
  if (!date) return null;
  return new Date(date + "T00:00:00Z").toISOString();
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!data || data.role !== "admin") {
    throw new Error("Forbidden: apenas admin pode importar.");
  }
}

type ParsedPayload = {
  rows: Row[];
  nomeParaEmail: Map<string, string>;
};

function parseWorkbook(base64: string): ParsedPayload {
  const wb = XLSX.read(base64, { type: "base64" });
  const dadosSheet = wb.Sheets["Dados Consolidados"];
  if (!dadosSheet) {
    throw new Error('Aba "Dados Consolidados" não encontrada no .xlsx.');
  }
  const rows = XLSX.utils.sheet_to_json<Row>(dadosSheet, {
    raw: false,
    defval: "",
  });
  const nomeParaEmail = new Map<string, string>();
  const usuariosSheet = wb.Sheets["Usuários"] ?? wb.Sheets["Usuarios"];
  if (usuariosSheet) {
    const usuarios = XLSX.utils.sheet_to_json<Row>(usuariosSheet, {
      raw: false,
      defval: "",
    });
    for (const u of usuarios) {
      const nome = get(u, "Nome", "Nome de exibição", "Nome do usuário");
      const email = get(u, "Email", "E-mail", "Endereço de email");
      if (nome && email) nomeParaEmail.set(norm(nome), email.toLowerCase());
    }
  }
  return { rows, nomeParaEmail };
}

// ============================ PREVIEW ============================
export const previewImportPlannerXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ arquivo_base64: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { rows, nomeParaEmail } = parseWorkbook(data.arquivo_base64);

    const { count: countAtual } = await supabaseAdmin
      .from("tarefas")
      .select("*", { count: "exact", head: true });

    const { data: projetos } = await supabaseAdmin
      .from("projetos")
      .select("id, nome, tipo");
    const projArr = (projetos ?? []) as Array<{
      id: string;
      nome: string;
      tipo: string;
    }>;
    const projByNorm = new Map(projArr.map((p) => [norm(p.nome), p]));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email");
    const emailToId = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string }>).map((p) => [
        p.email.toLowerCase(),
        p.id,
      ]),
    );

    // Status / prioridade breakdown
    const por_status: Record<string, number> = {};
    const por_prioridade: Record<string, number> = {};
    const buckets = new Map<string, { bucket: string; tarefas: number }>();
    const nomesSet = new Set<string>();

    for (const r of rows) {
      const st = norm(get(r, "Progresso", "Status"));
      por_status[st || "(vazio)"] = (por_status[st || "(vazio)"] ?? 0) + 1;
      const pr = norm(get(r, "Prioridade"));
      por_prioridade[pr || "(vazio)"] = (por_prioridade[pr || "(vazio)"] ?? 0) + 1;
      const b = get(r, "Categoria", "Bucket", "Bucket Name");
      if (b) {
        const k = norm(b);
        const cur = buckets.get(k) ?? { bucket: b, tarefas: 0 };
        cur.tarefas++;
        buckets.set(k, cur);
      }
      for (const n of splitPessoas(get(r, "Atribuído a", "Atribuido a"))) {
        nomesSet.add(n);
      }
      const cri = get(r, "Criado por", "Criada por");
      if (cri) nomesSet.add(cri);
    }

    const buckets_match: Array<{
      bucket: string;
      projeto_id: string;
      projeto_nome: string;
      como: "exato" | "fuzzy";
    }> = [];
    const buckets_sem_match: Array<{ bucket: string; tarefas: number }> = [];
    for (const [k, info] of buckets) {
      const ex = projByNorm.get(k);
      if (ex) {
        buckets_match.push({
          bucket: info.bucket,
          projeto_id: ex.id,
          projeto_nome: ex.nome,
          como: "exato",
        });
        continue;
      }
      const fz = projArr.find(
        (p) => norm(p.nome).includes(k) || k.includes(norm(p.nome)),
      );
      if (fz) {
        buckets_match.push({
          bucket: info.bucket,
          projeto_id: fz.id,
          projeto_nome: fz.nome,
          como: "fuzzy",
        });
      } else {
        buckets_sem_match.push({ bucket: info.bucket, tarefas: info.tarefas });
      }
    }

    const nomes_sem_profile: string[] = [];
    for (const nome of nomesSet) {
      const email = nomeParaEmail.get(norm(nome));
      if (!email || !emailToId.has(email)) nomes_sem_profile.push(nome);
    }

    return {
      total_linhas: rows.length,
      tarefas_ja_no_banco: countAtual ?? 0,
      pode_prosseguir: (countAtual ?? 0) === 0,
      por_status,
      por_prioridade,
      buckets_match: buckets_match.sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      ),
      buckets_sem_match: buckets_sem_match.sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      ),
      nomes_sem_profile: nomes_sem_profile.sort(),
    };
  });

// ============================ COMMIT ============================
const novoProjetoSchema = z.object({
  bucket: z.string(),
  nome: z.string(),
  tipo: z.enum(["ma", "novos_negocios"]),
  status: z.enum(["ativo", "pausado", "concluido", "arquivado", "perdido"]),
});

const commitSchema = z.object({
  arquivo_base64: z.string().min(10),
  mapeamento: z.record(z.string(), z.string()), // bucketNorm -> projeto_id | "NOVO" | "PULAR"
  novos_projetos: z.array(novoProjetoSchema).default([]),
  confirmar: z.literal("IMPORTAR_AGORA"),
});

export const commitImportPlannerXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => commitSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { count: countAtual } = await supabaseAdmin
      .from("tarefas")
      .select("*", { count: "exact", head: true });
    if ((countAtual ?? 0) > 0) {
      throw new Error(
        `Tabela tarefas não está vazia (${countAtual}). Importação abortada.`,
      );
    }

    const { rows, nomeParaEmail } = parseWorkbook(data.arquivo_base64);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email");
    const emailToId = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string }>).map((p) => [
        p.email.toLowerCase(),
        p.id,
      ]),
    );

    function resolverProfileIdPorNome(nome: string): string | null {
      const email = nomeParaEmail.get(norm(nome));
      if (!email) return null;
      return emailToId.get(email) ?? null;
    }

    // 1) Criar projetos novos
    const projetoIdPorBucket = new Map<string, string>();
    const projetosCriadosIds: string[] = [];
    if (data.novos_projetos.length > 0) {
      // Derivar um `estagio` válido por tipo a partir de algum projeto existente
      // do mesmo tipo — assim passa na CHECK constraint qualquer que seja o
      // conjunto aceito em produção. Fallback razoável se não houver nenhum.
      const { data: projetosExistentes } = await supabaseAdmin
        .from("projetos")
        .select("tipo, estagio");
      const existentes = (projetosExistentes ?? []) as Array<{
        tipo: string;
        estagio: string;
      }>;
      const estagioPorTipo: Record<"ma" | "novos_negocios", string> = {
        ma:
          existentes.find((p) => p.tipo === "ma")?.estagio ??
          "avaliacao_inicial",
        novos_negocios:
          existentes.find((p) => p.tipo === "novos_negocios")?.estagio ??
          "validacao",
      };

      const insertRows = data.novos_projetos.map((p) => ({
        nome: p.nome,
        tipo: p.tipo,
        status: p.status,
        responsavel_id: context.userId,
        estagio: estagioPorTipo[p.tipo],
      }));
      const { data: criados, error: errProj } = await supabaseAdmin
        .from("projetos")
        .insert(insertRows as never)
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
        if (!id) throw new Error(`Projeto criado não retornou id: ${np.nome}`);
        projetoIdPorBucket.set(norm(np.bucket), id);
        projetosCriadosIds.push(id);
      }
    }

    // 2) Montar tarefas
    const tarefasInsert: Array<Record<string, unknown>> = [];
    const puladas: string[] = [];
    let sem_responsavel = 0;
    const breakdown = { pendente: 0, em_andamento: 0, concluida: 0, cancelada: 0 };

    for (const r of rows) {
      const titulo = get(r, "Nome da tarefa", "Tarefa", "Título");
      if (!titulo) continue;
      const bucket = get(r, "Categoria", "Bucket", "Bucket Name");
      const bn = norm(bucket);
      const destino = data.mapeamento[bn] ?? projetoIdPorBucket.get(bn);
      if (!destino || destino === "PULAR") {
        puladas.push(`${bucket} | ${titulo}`);
        continue;
      }
      const projetoId =
        destino === "NOVO" ? projetoIdPorBucket.get(bn) : destino;
      if (!projetoId) {
        puladas.push(`${bucket} | ${titulo} (projeto não resolvido)`);
        continue;
      }

      const statusRaw = norm(get(r, "Progresso", "Status"));
      const status = STATUS_MAP[statusRaw] ?? "pendente";
      const prioRaw = norm(get(r, "Prioridade"));
      const prioridade = PRIO_MAP[prioRaw] ?? "media";

      const concluidaEmRaw = get(r, "Concluído em", "Concluido em");
      const criadoEmRaw = get(r, "Criado em", "Data de criação");
      const dataConclusaoRaw = get(
        r,
        "Data de conclusão",
        "Data de conclusao",
        "Data de vencimento",
      );

      let prazo: string | null = toIsoDate(dataConclusaoRaw);
      if (!prazo && status === "concluida") {
        prazo = toIsoDate(concluidaEmRaw) ?? toIsoDate(criadoEmRaw);
      }

      const concluida_em = toIsoTimestamp(concluidaEmRaw);
      const createdAt = toIsoTimestamp(criadoEmRaw) ?? new Date().toISOString();

      // Responsáveis
      const nomes = splitPessoas(get(r, "Atribuído a", "Atribuido a"));
      const responsavel_ids: string[] = [];
      const naoResolvidos: string[] = [];
      for (const n of nomes) {
        const id = resolverProfileIdPorNome(n);
        if (id) {
          if (!responsavel_ids.includes(id)) responsavel_ids.push(id);
        } else {
          naoResolvidos.push(n);
        }
      }
      if (responsavel_ids.length === 0) sem_responsavel++;

      // Criador
      const criadorNome = get(r, "Criado por", "Criada por");
      const criadorId =
        (criadorNome && resolverProfileIdPorNome(criadorNome)) || context.userId;

      // Descrição enriquecida
      const partes: string[] = [];
      if (prioRaw === "urgente") partes.push("[Prioridade original: urgente]");
      const notas = get(r, "Notas", "Observações", "Observacoes", "Descrição");
      if (notas) partes.push(notas);
      if (naoResolvidos.length > 0)
        partes.push(`[Também: ${naoResolvidos.join(", ")}]`);
      const descricao = partes.length > 0 ? partes.join(" | ") : null;

      breakdown[status]++;

      tarefasInsert.push({
        projeto_id: projetoId,
        titulo,
        descricao,
        responsavel_ids,
        criado_por_id: criadorId,
        prazo,
        status,
        prioridade,
        origem: "ad_hoc",
        data_reuniao: null,
        concluida_em,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }

    if (tarefasInsert.length === 0) {
      if (projetosCriadosIds.length > 0) {
        await supabaseAdmin
          .from("projetos")
          .delete()
          .in("id", projetosCriadosIds);
      }
      return {
        ok: false,
        razao: "Nenhuma tarefa válida para inserir.",
        puladas: puladas.length,
      };
    }

    const { error: errIns, count: insertedCount } = await supabaseAdmin
      .from("tarefas")
      .insert(tarefasInsert as never, { count: "exact" });

    if (errIns) {
      if (projetosCriadosIds.length > 0) {
        await supabaseAdmin
          .from("projetos")
          .delete()
          .in("id", projetosCriadosIds);
      }
      throw new Error(`Falha no insert (rollback feito): ${errIns.message}`);
    }

    return {
      ok: true,
      tarefas_inseridas: insertedCount ?? tarefasInsert.length,
      projetos_criados: projetosCriadosIds.length,
      puladas: puladas.length,
      tarefas_puladas_lista: puladas.slice(0, 50),
      sem_responsavel,
      breakdown_por_status: breakdown,
    };
  });
