
-- Enums
CREATE TYPE public.tarefa_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.tarefa_prioridade AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE public.tarefa_origem AS ENUM ('reuniao_pipeline', 'ad_hoc');
CREATE TYPE public.notif_tarefa_tipo AS ENUM ('atribuicao', 'um_dia_antes', 'vencimento');

-- Tabela tarefas
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid NOT NULL,
  criado_por_id uuid NOT NULL,
  prazo date NOT NULL,
  status public.tarefa_status NOT NULL DEFAULT 'pendente',
  prioridade public.tarefa_prioridade NOT NULL DEFAULT 'media',
  origem public.tarefa_origem NOT NULL DEFAULT 'ad_hoc',
  data_reuniao date,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarefas_projeto ON public.tarefas(projeto_id);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX idx_tarefas_prazo ON public.tarefas(prazo);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_tarefas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tarefas_updated_at
BEFORE UPDATE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.set_tarefas_updated_at();

-- Tabela notificacoes_enviadas (com responsavel_id_notificado pra suportar reatribuição)
CREATE TABLE public.notificacoes_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tipo public.notif_tarefa_tipo NOT NULL,
  responsavel_id_notificado uuid NOT NULL,
  enviada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, tipo, responsavel_id_notificado)
);

CREATE INDEX idx_notif_tarefa ON public.notificacoes_enviadas(tarefa_id);

-- RLS
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;

-- Tarefas: SELECT qualquer autenticado
CREATE POLICY tarefas_select_authenticated ON public.tarefas
  FOR SELECT TO authenticated USING (true);

-- INSERT: não-observador, criado_por = self
CREATE POLICY tarefas_insert_non_observador ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_id = auth.uid()
    AND app_private.current_user_role() <> 'observador'::user_role
  );

-- UPDATE: criador, responsável ou admin (e não-observador)
CREATE POLICY tarefas_update_owner_responsavel_admin ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    (criado_por_id = auth.uid()
     OR responsavel_id = auth.uid()
     OR app_private.current_user_role() = 'admin'::user_role)
    AND app_private.current_user_role() <> 'observador'::user_role
  )
  WITH CHECK (
    (criado_por_id = auth.uid()
     OR responsavel_id = auth.uid()
     OR app_private.current_user_role() = 'admin'::user_role)
    AND app_private.current_user_role() <> 'observador'::user_role
  );

-- DELETE: criador ou admin
CREATE POLICY tarefas_delete_owner_or_admin ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    criado_por_id = auth.uid()
    OR app_private.current_user_role() = 'admin'::user_role
  );

-- Notificações: apenas admin pode ver; inserts via service role
CREATE POLICY notificacoes_select_admin ON public.notificacoes_enviadas
  FOR SELECT TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role);
