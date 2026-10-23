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

export type EscopoTarefasPadrao = "minhas" | "time" | "todas";

export type PreferenciasNotificacao = {
  email_notificacoes: boolean;
  view_tarefas_modo: ViewTarefasModo;
  email_tarefa_atribuida: boolean;
  email_tarefa_vencendo: boolean;
  email_resumo_semanal: boolean;
  escopo_padrao_tarefas: EscopoTarefasPadrao;
};

export const DEFAULT_PREFERENCIAS: PreferenciasNotificacao = {
  email_notificacoes: true,
  view_tarefas_modo: "kanban",
  email_tarefa_atribuida: true,
  email_tarefa_vencendo: true,
  email_resumo_semanal: false,
  escopo_padrao_tarefas: "minhas",
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

  const emailAtribuida = typeof prefs.email_tarefa_atribuida === "boolean"
    ? prefs.email_tarefa_atribuida
    : DEFAULT_PREFERENCIAS.email_tarefa_atribuida;

  const emailVencendo = typeof prefs.email_tarefa_vencendo === "boolean"
    ? prefs.email_tarefa_vencendo
    : DEFAULT_PREFERENCIAS.email_tarefa_vencendo;

  const emailResumo = typeof prefs.email_resumo_semanal === "boolean"
    ? prefs.email_resumo_semanal
    : DEFAULT_PREFERENCIAS.email_resumo_semanal;

  const escopoRaw = prefs.escopo_padrao_tarefas;
  const escopo: EscopoTarefasPadrao =
    escopoRaw === "minhas" || escopoRaw === "time" || escopoRaw === "todas"
      ? escopoRaw
      : DEFAULT_PREFERENCIAS.escopo_padrao_tarefas;

  return {
    email_notificacoes: email,
    view_tarefas_modo: modo,
    email_tarefa_atribuida: emailAtribuida,
    email_tarefa_vencendo: emailVencendo,
    email_resumo_semanal: emailResumo,
    escopo_padrao_tarefas: escopo,
  };
}

