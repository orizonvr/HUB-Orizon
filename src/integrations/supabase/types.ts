export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      atividades: {
        Row: {
          acao: string
          autor_id: string | null
          criado_em: string
          detalhes: Json
          id: string
          projeto_id: string
        }
        Insert: {
          acao: string
          autor_id?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
          projeto_id: string
        }
        Update: {
          acao?: string
          autor_id?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          autor_id: string
          conteudo: string
          criado_em: string
          id: string
          projeto_id: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          criado_em?: string
          id?: string
          projeto_id: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          criado_em?: string
          id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      comite_pauta: {
        Row: {
          atualizado_em: string
          briefing_snapshot: Json | null
          comite_id: string
          condicionantes: string | null
          criado_em: string
          decisao: string | null
          estagio_sugerido: string | null
          id: string
          justificativa: string | null
          ordem: number
          projeto_id: string
          relator_id: string | null
        }
        Insert: {
          atualizado_em?: string
          briefing_snapshot?: Json | null
          comite_id: string
          condicionantes?: string | null
          criado_em?: string
          decisao?: string | null
          estagio_sugerido?: string | null
          id?: string
          justificativa?: string | null
          ordem?: number
          projeto_id: string
          relator_id?: string | null
        }
        Update: {
          atualizado_em?: string
          briefing_snapshot?: Json | null
          comite_id?: string
          condicionantes?: string | null
          criado_em?: string
          decisao?: string | null
          estagio_sugerido?: string | null
          id?: string
          justificativa?: string | null
          ordem?: number
          projeto_id?: string
          relator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comite_pauta_comite_id_fkey"
            columns: ["comite_id"]
            isOneToOne: false
            referencedRelation: "comites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comite_pauta_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comite_pauta_relator_id_fkey"
            columns: ["relator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comites: {
        Row: {
          ata_consolidada: string | null
          atualizado_em: string
          criado_em: string
          criado_por_id: string
          data: string
          id: string
          participante_ids: string[]
          status: string
          titulo: string
        }
        Insert: {
          ata_consolidada?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por_id: string
          data: string
          id?: string
          participante_ids?: string[]
          status?: string
          titulo: string
        }
        Update: {
          ata_consolidada?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por_id?: string
          data?: string
          id?: string
          participante_ids?: string[]
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comites_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          criado_em: string
          criado_por: string | null
          expira_em: string
          id: string
          profile_id: string
          token: string
          usado_em: string | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          expira_em?: string
          id?: string
          profile_id: string
          token?: string
          usado_em?: string | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          expira_em?: string
          id?: string
          profile_id?: string
          token?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          criado_em: string
          enviado_por: string
          id: string
          nome: string
          projeto_id: string
          tamanho_bytes: number | null
          tipo: string | null
          url_storage: string
        }
        Insert: {
          criado_em?: string
          enviado_por: string
          id?: string
          nome: string
          projeto_id: string
          tamanho_bytes?: number | null
          tipo?: string | null
          url_storage: string
        }
        Update: {
          criado_em?: string
          enviado_por?: string
          id?: string
          nome?: string
          projeto_id?: string
          tamanho_bytes?: number | null
          tipo?: string | null
          url_storage?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lida: boolean
          tarefa_id: string | null
          tipo: Database["public"]["Enums"]["notif_tarefa_tipo"]
          titulo: string
          url_destino: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          tarefa_id?: string | null
          tipo: Database["public"]["Enums"]["notif_tarefa_tipo"]
          titulo: string
          url_destino?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          tarefa_id?: string | null
          tipo?: Database["public"]["Enums"]["notif_tarefa_tipo"]
          titulo?: string
          url_destino?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_enviadas: {
        Row: {
          enviada_em: string
          id: string
          responsavel_id_notificado: string
          tarefa_id: string
          tipo: Database["public"]["Enums"]["notif_tarefa_tipo"]
          usuario_destino: string
        }
        Insert: {
          enviada_em?: string
          id?: string
          responsavel_id_notificado: string
          tarefa_id: string
          tipo: Database["public"]["Enums"]["notif_tarefa_tipo"]
          usuario_destino: string
        }
        Update: {
          enviada_em?: string
          id?: string
          responsavel_id_notificado?: string
          tarefa_id?: string
          tipo?: Database["public"]["Enums"]["notif_tarefa_tipo"]
          usuario_destino?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_enviadas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo: string | null
          criado_em: string
          email: string
          id: string
          nome_completo: string
          preferencias: Json
          role: Database["public"]["Enums"]["user_role"]
          status_convite: Database["public"]["Enums"]["convite_status"]
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string
          email: string
          id?: string
          nome_completo: string
          preferencias?: Json
          role?: Database["public"]["Enums"]["user_role"]
          status_convite?: Database["public"]["Enums"]["convite_status"]
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome_completo?: string
          preferencias?: Json
          role?: Database["public"]["Enums"]["user_role"]
          status_convite?: Database["public"]["Enums"]["convite_status"]
        }
        Relationships: []
      }
      projetos: {
        Row: {
          atualizado_em: string
          capex_estimado: number | null
          contraparte: string | null
          criado_em: string
          data_fechamento_prevista: string | null
          data_fechamento_real: string | null
          data_inicio: string | null
          descricao: string | null
          ebitda_2025: number | null
          ebitda_alvo: number | null
          estagio: string
          id: string
          lider_id: string | null
          multiplo_ev_ebitda: number | null
          nome: string
          notas_estrategicas: string | null
          payback_anos: number | null
          percentual_orizon: number | null
          proximos_passos: string | null
          receita_projetada_ano3: number | null
          responsavel_id: string | null
          riscos: string | null
          setor: string | null
          sinergias_estimadas: number | null
          status: Database["public"]["Enums"]["projeto_status"]
          status_detalhado: string | null
          subcategoria: string | null
          tam: number | null
          tese: string | null
          tipo: Database["public"]["Enums"]["projeto_tipo"]
          tir_estimada: number | null
          valor_estimado: number | null
          valor_transacao_mm: number | null
          volume_ton_dia: number | null
        }
        Insert: {
          atualizado_em?: string
          capex_estimado?: number | null
          contraparte?: string | null
          criado_em?: string
          data_fechamento_prevista?: string | null
          data_fechamento_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          ebitda_2025?: number | null
          ebitda_alvo?: number | null
          estagio: string
          id?: string
          lider_id?: string | null
          multiplo_ev_ebitda?: number | null
          nome: string
          notas_estrategicas?: string | null
          payback_anos?: number | null
          percentual_orizon?: number | null
          proximos_passos?: string | null
          receita_projetada_ano3?: number | null
          responsavel_id?: string | null
          riscos?: string | null
          setor?: string | null
          sinergias_estimadas?: number | null
          status?: Database["public"]["Enums"]["projeto_status"]
          status_detalhado?: string | null
          subcategoria?: string | null
          tam?: number | null
          tese?: string | null
          tipo: Database["public"]["Enums"]["projeto_tipo"]
          tir_estimada?: number | null
          valor_estimado?: number | null
          valor_transacao_mm?: number | null
          volume_ton_dia?: number | null
        }
        Update: {
          atualizado_em?: string
          capex_estimado?: number | null
          contraparte?: string | null
          criado_em?: string
          data_fechamento_prevista?: string | null
          data_fechamento_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          ebitda_2025?: number | null
          ebitda_alvo?: number | null
          estagio?: string
          id?: string
          lider_id?: string | null
          multiplo_ev_ebitda?: number | null
          nome?: string
          notas_estrategicas?: string | null
          payback_anos?: number | null
          percentual_orizon?: number | null
          proximos_passos?: string | null
          receita_projetada_ano3?: number | null
          responsavel_id?: string | null
          riscos?: string | null
          setor?: string | null
          sinergias_estimadas?: number | null
          status?: Database["public"]["Enums"]["projeto_status"]
          status_detalhado?: string | null
          subcategoria?: string | null
          tam?: number | null
          tese?: string | null
          tipo?: Database["public"]["Enums"]["projeto_tipo"]
          tir_estimada?: number | null
          valor_estimado?: number | null
          valor_transacao_mm?: number | null
          volume_ton_dia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluida_em: string | null
          created_at: string
          criado_por_id: string
          data_reuniao: string | null
          descricao: string | null
          id: string
          origem: Database["public"]["Enums"]["tarefa_origem"]
          prazo: string | null
          prioridade: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id: string
          responsavel_ids: string[]
          status: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          criado_por_id: string
          data_reuniao?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["tarefa_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id: string
          responsavel_ids: string[]
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          criado_por_id?: string
          data_reuniao?: string | null
          descricao?: string | null
          id?: string
          origem?: Database["public"]["Enums"]["tarefa_origem"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["tarefa_prioridade"]
          projeto_id?: string
          responsavel_ids?: string[]
          status?: Database["public"]["Enums"]["tarefa_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      convite_status: "pendente" | "ativo"
      notif_tarefa_tipo:
        | "atribuicao"
        | "um_dia_antes"
        | "vencimento"
        | "vence_hoje"
      projeto_status:
        | "ativo"
        | "pausado"
        | "concluido"
        | "arquivado"
        | "perdido"
      projeto_tipo: "ma" | "novos_negocios"
      tarefa_origem: "reuniao_pipeline" | "ad_hoc"
      tarefa_prioridade: "baixa" | "media" | "alta"
      tarefa_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      user_role: "admin" | "lider" | "analista" | "observador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      convite_status: ["pendente", "ativo"],
      notif_tarefa_tipo: [
        "atribuicao",
        "um_dia_antes",
        "vencimento",
        "vence_hoje",
      ],
      projeto_status: ["ativo", "pausado", "concluido", "arquivado", "perdido"],
      projeto_tipo: ["ma", "novos_negocios"],
      tarefa_origem: ["reuniao_pipeline", "ad_hoc"],
      tarefa_prioridade: ["baixa", "media", "alta"],
      tarefa_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      user_role: ["admin", "lider", "analista", "observador"],
    },
  },
} as const
