// Server-only helpers for creating notifications and sending email via Resend.
// MUST NOT be imported from client-side code.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  NotificacaoTipo,
  PreferenciasNotificacao,
} from "./notificacoes-types";
import { normalizePreferencias } from "./notificacoes-types";

// Envio direto pela API oficial do Resend (https://resend.com/docs/api-reference).
// Substitui o gateway da Lovable (connector-gateway.lovable.dev), que só existe
// dentro da plataforma Lovable. Assim o envio de email funciona em qualquer host
// (Azure, etc.) usando apenas a RESEND_API_KEY.
const RESEND_API_URL = "https://api.resend.com";

function appBaseUrl() {
  return process.env.APP_BASE_URL || "https://orizon-pipeline.lovable.app";
}

function emailFrom() {
  return process.env.EMAIL_FROM || "OrizonVR Pipeline <onboarding@resend.dev>";
}

function fmtDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type SendEmailInput = { to: string; subject: string; html: string };

async function sendEmail({ to, subject, html }: SendEmailInput) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[notificacoes.server] RESEND_API_KEY não configurada, pulando email.");
    return { skipped: true as const };
  }
  const res = await fetch(`${RESEND_API_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: emailFrom(), to: [to], subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend falhou [${res.status}]: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return { skipped: false as const, body };
}

const SAGE = "#2D4A3E";
const SAGE_LIGHT = "#F1F5F2";

function emailLayout(opts: {
  preheader: string;
  greeting: string;
  intro: string;
  titulo: string;
  projetoNome: string;
  prazo: string;
  prioridade: string;
  descricao?: string | null;
  ctaUrl: string;
  ctaLabel: string;
}) {
  const desc = opts.descricao
    ? `<tr><td style="padding:6px 0;color:#475569;font-size:13px"><strong style="color:#0f172a">Descrição:</strong> ${escapeHtml(opts.descricao)}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <tr><td style="background:${SAGE};padding:18px 24px">
        <div style="color:#ffffff;font-size:14px;font-weight:600;letter-spacing:.3px">OrizonVR · Pipeline</div>
      </td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font-size:15px">${escapeHtml(opts.greeting)}</p>
        <p style="margin:0 0 18px;font-size:14px;color:#475569">${escapeHtml(opts.intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAGE_LIGHT};border-radius:6px;padding:14px 16px;margin:0 0 22px">
          <tr><td style="padding:6px 0;font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(opts.titulo)}</td></tr>
          <tr><td style="padding:6px 0;color:#475569;font-size:13px"><strong style="color:#0f172a">Projeto:</strong> ${escapeHtml(opts.projetoNome)}</td></tr>
          <tr><td style="padding:6px 0;color:#475569;font-size:13px"><strong style="color:#0f172a">Prazo:</strong> ${escapeHtml(fmtDateBR(opts.prazo))}</td></tr>
          <tr><td style="padding:6px 0;color:#475569;font-size:13px"><strong style="color:#0f172a">Prioridade:</strong> ${escapeHtml(opts.prioridade)}</td></tr>
          ${desc}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:${SAGE}">
          <a href="${opts.ctaUrl}" style="display:inline-block;padding:10px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:6px">${escapeHtml(opts.ctaLabel)}</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid #e2e8f0;background:#fafafa">
        <p style="margin:0;font-size:12px;color:#64748b">OrizonVR | Pipeline Alocação de Capital</p>
        <p style="margin:4px 0 0;font-size:11px;color:#94a3b8">Você está recebendo este email porque é responsável pela tarefa.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PRIO_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export type TarefaCronPayload = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string;
  prioridade: string;
  projeto_id: string;
  responsavel_ids: string[];
  criado_por_id: string;
};

export type CreateNotificacaoInput = {
  tipo: NotificacaoTipo;
  tarefa_id: string;
  /** Optional pre-fetched task (avoids extra DB roundtrip in cron). */
  tarefa?: TarefaCronPayload;
  /** If provided, notifica APENAS estes destinatários. Caso contrário,
   * itera por `responsavel_ids` da tarefa. */
  destinatarios?: string[];
};

type ProfileInfo = {
  id: string;
  nome_completo: string;
  email: string;
  preferencias: PreferenciasNotificacao;
};

async function fetchProfile(id: string): Promise<ProfileInfo | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, nome_completo, email, preferencias")
    .eq("id", id)
    .single();
  if (!data) return null;
  const prefsRaw = (data as { preferencias?: unknown }).preferencias;
  return {
    id: data.id,
    nome_completo: data.nome_completo,
    email: data.email,
    preferencias: normalizePreferencias(prefsRaw),
  };
}

async function fetchProjetoInfo(
  id: string,
): Promise<{ nome: string; tipo: "ma" | "novos_negocios" }> {
  const { data } = await supabaseAdmin
    .from("projetos")
    .select("nome, tipo")
    .eq("id", id)
    .single();
  return {
    nome: data?.nome ?? "—",
    tipo: data?.tipo === "novos_negocios" ? "novos_negocios" : "ma",
  };
}

async function processarParaDestinatario(
  tarefa: TarefaCronPayload,
  tipo: NotificacaoTipo,
  projetoNome: string,
  urlDestino: string,
  destinatario: ProfileInfo,
) {
  // 1) Título/descrição in-app
  let titulo: string;
  let descricao: string;
  switch (tipo) {
    case "atribuicao": {
      let criadorNome = "Alguém";
      if (tarefa.criado_por_id !== destinatario.id) {
        const criador = await fetchProfile(tarefa.criado_por_id);
        criadorNome = criador?.nome_completo ?? "Alguém";
      }
      titulo = `${criadorNome} atribuiu uma tarefa pra você`;
      descricao = `${tarefa.titulo} · ${projetoNome} · vence ${fmtDateBR(tarefa.prazo)}`;
      break;
    }
    case "um_dia_antes":
      titulo = "Tarefa vence amanhã";
      descricao = `${tarefa.titulo} · ${projetoNome} · ${fmtDateBR(tarefa.prazo)}`;
      break;
    case "vence_hoje":
      titulo = "Tarefa vence hoje";
      descricao = `${tarefa.titulo} · ${projetoNome}`;
      break;
    case "vencimento":
      titulo = "Tarefa vencida";
      descricao = `${tarefa.titulo} · ${projetoNome} · venceu ${fmtDateBR(tarefa.prazo)}`;
      break;
  }

  // 2) In-app idempotência por (tarefa, tipo, usuario)
  const { data: existentes } = await supabaseAdmin
    .from("notificacoes")
    .select("id, created_at")
    .eq("usuario_id", destinatario.id)
    .eq("tarefa_id", tarefa.id)
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(1);
  const exist = existentes?.[0];
  if (exist) {
    if (tipo !== "vencimento") return;
    const ageDays =
      (Date.now() - new Date(exist.created_at).getTime()) / 86_400_000;
    if (ageDays < 7) return;
  }

  await supabaseAdmin.from("notificacoes").insert({
    usuario_id: destinatario.id,
    tipo,
    tarefa_id: tarefa.id,
    titulo,
    descricao,
    url_destino: urlDestino,
    lida: false,
  });

  // 3) Email
  if (tipo === "vencimento") return;
  if (!destinatario.preferencias.email_notificacoes) return;

  const { data: enviadas } = await supabaseAdmin
    .from("notificacoes_enviadas")
    .select("id")
    .eq("tarefa_id", tarefa.id)
    .eq("tipo", tipo)
    .eq("usuario_destino", destinatario.id)
    .limit(1);
  if (enviadas && enviadas.length > 0) return;

  const ctaUrl = `${appBaseUrl()}${urlDestino}`;
  const prioLabel = PRIO_LABEL[tarefa.prioridade] ?? tarefa.prioridade;
  let subject: string;
  let intro: string;
  const ctaLabel = "Abrir tarefa no app";
  if (tipo === "atribuicao") {
    let criadorNome = "Alguém";
    if (tarefa.criado_por_id !== destinatario.id) {
      const criador = await fetchProfile(tarefa.criado_por_id);
      criadorNome = criador?.nome_completo ?? "Alguém";
    }
    subject = `Nova tarefa: ${tarefa.titulo}`;
    intro = `${criadorNome} atribuiu uma nova tarefa pra você.`;
  } else if (tipo === "um_dia_antes") {
    subject = `Lembrete: tarefa vence amanhã — ${tarefa.titulo}`;
    intro = `Sua tarefa vence amanhã, ${fmtDateBR(tarefa.prazo)}.`;
  } else {
    subject = `Tarefa vence hoje — ${tarefa.titulo}`;
    intro = `Sua tarefa vence hoje, ${fmtDateBR(tarefa.prazo)}.`;
  }

  const html = emailLayout({
    preheader: intro,
    greeting: `Olá, ${destinatario.nome_completo.split(" ")[0] || destinatario.nome_completo}`,
    intro,
    titulo: tarefa.titulo,
    projetoNome,
    prazo: tarefa.prazo,
    prioridade: prioLabel,
    descricao: tarefa.descricao,
    ctaUrl,
    ctaLabel,
  });

  try {
    await sendEmail({ to: destinatario.email, subject, html });
    await supabaseAdmin.from("notificacoes_enviadas").insert({
      tarefa_id: tarefa.id,
      tipo,
      responsavel_id_notificado: destinatario.id,
      usuario_destino: destinatario.id,
    });
  } catch (err) {
    console.error("[notificacoes.server] envio falhou:", (err as Error).message);
  }
}

export async function enqueueNotificacaoTarefa(
  input: CreateNotificacaoInput,
): Promise<void> {
  let tarefa = input.tarefa;
  if (!tarefa) {
    const { data } = await supabaseAdmin
      .from("tarefas")
      .select(
        "id, titulo, descricao, prazo, prioridade, projeto_id, responsavel_ids, criado_por_id",
      )
      .eq("id", input.tarefa_id)
      .single();
    if (!data) return;
    tarefa = {
      id: data.id,
      titulo: data.titulo,
      descricao: data.descricao,
      prazo: data.prazo,
      prioridade: data.prioridade,
      projeto_id: data.projeto_id,
      responsavel_ids: (data.responsavel_ids ?? []) as string[],
      criado_por_id: data.criado_por_id,
    };
  }
  if (!tarefa) return;

  const destinatarioIds = input.destinatarios ?? tarefa.responsavel_ids ?? [];
  if (destinatarioIds.length === 0) return;

  const projeto = await fetchProjetoInfo(tarefa.projeto_id);
  const baseProjetoPath =
    projeto.tipo === "novos_negocios" ? "/novos-negocios" : "/ma";
  const urlDestino = `${baseProjetoPath}?projeto=${tarefa.projeto_id}&tab=tarefas`;

  for (const id of destinatarioIds) {
    const dest = await fetchProfile(id);
    if (!dest) continue;
    await processarParaDestinatario(
      tarefa,
      input.tipo,
      projeto.nome,
      urlDestino,
      dest,
    ).catch((e) =>
      console.error("[notificacoes.server] dest:", id, (e as Error).message),
    );
  }
}
