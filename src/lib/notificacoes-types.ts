// Client-safe types & helpers for notificações.

export type NotificacaoTipo =
  | "atribuicao"
  | "um_dia_antes"
  | "vence_hoje"
  | "vencimento";

export type Notificacao = {
  id: string;
  usuario_id: string;
  tipo: NotificacaoTipo;
  tarefa_id: string | null;
  titulo: string;
  descricao: string | null;
  url_destino: string | null;
  lida: boolean;
  created_at: string;
};

export const TIPO_LABEL: Record<NotificacaoTipo, string> = {
  atribuicao: "Tarefa atribuída",
  um_dia_antes: "Vence amanhã",
  vence_hoje: "Vence hoje",
  vencimento: "Tarefa vencida",
};

export type ViewTarefasModo = "tabela" | "cards" | "kanban";

export type PreferenciasNotificacao = {
  email_notificacoes: boolean;
  view_tarefas_modo: ViewTarefasModo;
};

export const DEFAULT_PREFERENCIAS: PreferenciasNotificacao = {
  email_notificacoes: true,
  view_tarefas_modo: "kanban",
};

export function normalizePreferencias(raw: unknown): PreferenciasNotificacao {
  const prefs = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  let email: boolean;
  if (typeof prefs.email_notificacoes === "boolean") {
    email = prefs.email_notificacoes;
  } else {
    const legacyAtribuida = prefs.email_tarefa_atribuida === true;
    const legacyVencendo = prefs.email_tarefa_vencendo === true;
    email = legacyAtribuida || legacyVencendo || DEFAULT_PREFERENCIAS.email_notificacoes;
  }
  const modoRaw = prefs.view_tarefas_modo;
  const modo: ViewTarefasModo =
    modoRaw === "tabela" || modoRaw === "cards" || modoRaw === "kanban"
      ? modoRaw
      : DEFAULT_PREFERENCIAS.view_tarefas_modo;
  return { email_notificacoes: email, view_tarefas_modo: modo };
}
