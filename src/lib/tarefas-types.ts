// Client-safe types & constants for tarefas.

export type TarefaStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type TarefaPrioridade = "baixa" | "media" | "alta";
export type TarefaOrigem = "reuniao_pipeline" | "ad_hoc";

export const STATUS_LABEL: Record<TarefaStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const ORIGEM_LABEL: Record<TarefaOrigem, string> = {
  reuniao_pipeline: "Reunião de pipeline",
  ad_hoc: "Ad hoc",
};

export type Tarefa = {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  /** Lista de responsáveis. Sempre tem ≥1 elemento. */
  /** Lista de responsáveis. Pode ser vazia em tarefas importadas. */
  responsavel_ids: string[];
  criado_por_id: string;
  prazo: string | null; // YYYY-MM-DD, nullable para tarefas importadas sem vencimento
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  origem: TarefaOrigem;
  data_reuniao: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
};

export type ResponsavelLite = {
  id: string;
  nome: string;
  avatar_url: string | null;
};

export type TarefaComContexto = Tarefa & {
  projeto_nome: string;
  projeto_tipo: "ma" | "novos_negocios";
  responsaveis: ResponsavelLite[];
};
