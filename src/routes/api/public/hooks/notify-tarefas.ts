// Cron endpoint: roda diariamente às 8h SP. Cria notificações in-app e dispara emails
// para tarefas vencendo amanhã/hoje e tarefas vencidas (uma vez por semana).
//
// Auth: exige header `Authorization: Bearer <CRON_SECRET>` (process.env.CRON_SECRET).
// O CRON_SECRET é um secret de runtime (process.env.CRON_SECRET).
//
// Exemplo manual:
//   curl -X POST "https://project--9b6d469b-946d-451c-bccb-76dfc77e8a23.lovable.app/api/public/hooks/notify-tarefas" \
//     -H "Authorization: Bearer $CRON_SECRET"

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueNotificacaoTarefa } from "@/lib/notificacoes.server";

function todayInSP(): { hoje: string; amanha: string } {
  // America/Sao_Paulo é UTC-3 (sem horário de verão atualmente)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hoje = `${y}-${m}-${d}`;
  const t = new Date(now.getTime() + 86_400_000);
  const amanha = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  return { hoje, amanha };
}

const SELECT_COLS =
  "id, titulo, descricao, prazo, prioridade, projeto_id, responsavel_ids, criado_por_id";

type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string;
  prioridade: string;
  projeto_id: string;
  responsavel_ids: string[] | null;
  criado_por_id: string;
};

function toPayload(t: TarefaRow) {
  return {
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    prazo: t.prazo,
    prioridade: t.prioridade,
    projeto_id: t.projeto_id,
    responsavel_ids: (t.responsavel_ids ?? []) as string[],
    criado_por_id: t.criado_por_id,
  };
}

async function processar() {
  const { hoje, amanha } = todayInSP();
  const stats = { vence_amanha: 0, vence_hoje: 0, vencida: 0 };

  const buckets: Array<{
    key: "vence_amanha" | "vence_hoje" | "vencida";
    tipo: "um_dia_antes" | "vence_hoje" | "vencimento";
    query: () => Promise<{ data: TarefaRow[] | null }>;
  }> = [
    {
      key: "vence_amanha",
      tipo: "um_dia_antes",
      query: () =>
        supabaseAdmin
          .from("tarefas")
          .select(SELECT_COLS)
          .eq("prazo", amanha)
          .in("status", ["pendente", "em_andamento"]) as unknown as Promise<{
          data: TarefaRow[] | null;
        }>,
    },
    {
      key: "vence_hoje",
      tipo: "vence_hoje",
      query: () =>
        supabaseAdmin
          .from("tarefas")
          .select(SELECT_COLS)
          .eq("prazo", hoje)
          .in("status", ["pendente", "em_andamento"]) as unknown as Promise<{
          data: TarefaRow[] | null;
        }>,
    },
    {
      key: "vencida",
      tipo: "vencimento",
      query: () =>
        supabaseAdmin
          .from("tarefas")
          .select(SELECT_COLS)
          .lt("prazo", hoje)
          .in("status", ["pendente", "em_andamento"]) as unknown as Promise<{
          data: TarefaRow[] | null;
        }>,
    },
  ];

  for (const b of buckets) {
    const { data: rows } = await b.query();
    for (const t of rows ?? []) {
      await enqueueNotificacaoTarefa({
        tipo: b.tipo,
        tarefa_id: t.id,
        tarefa: toPayload(t),
      }).catch((e) => console.error(`notify ${b.key}:`, e));
      stats[b.key]++;
    }
  }

  return { hoje, amanha, ...stats };
}

function checkAuth(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "CRON_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  const ok =
    providedBuf.length === expectedBuf.length &&
    timingSafeEqual(providedBuf, expectedBuf);
  if (!ok) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}

async function handle(request: Request) {
  const unauthorized = checkAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const result = await processar();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/notify-tarefas")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

