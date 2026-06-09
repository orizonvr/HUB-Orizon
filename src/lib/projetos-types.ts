// Client-safe constants & types for projetos.

export const MA_ESTAGIOS = [
  { key: "analise_inicial", label: "Análise Inicial" },
  { key: "nda_preenchimento", label: "NDA em preenchimento" },
  { key: "nda_assinado", label: "NDA assinado" },
  { key: "elaborando_nbo", label: "Elaborando NBO" },
  { key: "nbo_submetida", label: "NBO submetida" },
  { key: "due_diligence", label: "Due Diligence" },
  { key: "negociacao", label: "Negociação" },
  { key: "opcao_compra_assinada", label: "Opção de Compra Assinada" },
  { key: "assinatura_spa", label: "Assinatura do SPA" },
  { key: "pos_ma_integracao", label: "Pós-M&A / Integração" },
] as const;

export const NN_ESTAGIOS = [
  { key: "analise_viabilidade", label: "Análise de Viabilidade" },
  { key: "discussoes_offtaker", label: "Discussões com Offtaker" },
  { key: "negociacao", label: "Negociação" },
  { key: "aprovacao_comite", label: "Aprovação Comitê" },
  { key: "implementacao", label: "Implementação" },
  { key: "operacao", label: "Operação" },
] as const;

export const SUBCATEGORIAS = [
  { key: "biometano", label: "Biometano" },
  { key: "co2", label: "CO2" },
  { key: "energia", label: "Energia" },
  { key: "economia_circular", label: "Economia Circular" },
  { key: "waste_to_energy", label: "Waste-to-Energy" },
  { key: "aterros_greenfield", label: "Aterros Greenfield" },
  { key: "licitacoes_ppps", label: "Licitações/PPPs" },
] as const;

export const SUBCATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  SUBCATEGORIAS.map((s) => [s.key, s.label]),
);

export type ProjetoTipo = "ma" | "novos_negocios";
export type UserRole = "admin" | "lider" | "analista" | "observador";

export type Profile = {
  id: string;
  nome_completo: string;
  cargo: string | null;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  ativo?: boolean;
};

export type Projeto = {
  id: string;
  tipo: ProjetoTipo;
  nome: string;
  contraparte: string | null;
  setor: string | null;
  subcategoria: string | null;
  status_detalhado: string | null;
  estagio: string;
  status: "ativo" | "pausado" | "concluido" | "arquivado" | "perdido";
  descricao: string | null;
  tese: string | null;
  riscos: string | null;
  proximos_passos: string | null;
  valor_estimado: number | null;
  ebitda_alvo: number | null;
  ebitda_2025: number | null;
  multiplo_ev_ebitda: number | null;
  sinergias_estimadas: number | null;
  tir_estimada: number | null;
  payback_anos: number | null;
  capex_estimado: number | null;
  receita_projetada_ano3: number | null;
  tam: number | null;
  volume_ton_dia: number | null;
  percentual_orizon: number | null;
  valor_transacao_mm: number | null;
  notas_estrategicas: string | null;
  responsavel_id: string | null;
  lider_id: string | null;
  data_inicio: string | null;
  data_fechamento_prevista: string | null;
  data_fechamento_real: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Comentario = {
  id: string;
  projeto_id: string;
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  criado_em: string;
};

export type Documento = {
  id: string;
  projeto_id: string;
  nome: string;
  tipo: string | null;
  tamanho_bytes: number | null;
  url_storage: string;
  enviado_por: string;
  enviado_por_nome: string;
  criado_em: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type Atividade = {
  id: string;
  projeto_id: string;
  autor_id: string | null;
  autor_nome: string;
  acao: string;
  detalhes: { [k: string]: JsonValue };
  criado_em: string;
};
