-- 1) Estender enum existente para suportar 'vence_hoje'
ALTER TYPE public.notif_tarefa_tipo ADD VALUE IF NOT EXISTS 'vence_hoje';

-- 2) Tabela notificacoes
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo public.notif_tarefa_tipo NOT NULL,
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  url_destino text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user_unread_recent
  ON public.notificacoes (usuario_id, lida, created_at DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificacoes_select_own ON public.notificacoes;
CREATE POLICY notificacoes_select_own ON public.notificacoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS notificacoes_update_own ON public.notificacoes;
CREATE POLICY notificacoes_update_own ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS notificacoes_delete_own ON public.notificacoes;
CREATE POLICY notificacoes_delete_own ON public.notificacoes
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid());

-- 3) Preferências de notificação por usuário
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferencias jsonb NOT NULL
  DEFAULT jsonb_build_object(
    'email_tarefa_atribuida', true,
    'email_tarefa_vencendo', true
  );