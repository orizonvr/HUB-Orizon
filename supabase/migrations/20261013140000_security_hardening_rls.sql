-- ==============================================================================
-- MIGRATION: 20261013140000_security_hardening_rls.sql
-- FASE 5: Hardening de RLS e Segregação de Dados no Supabase
--
-- Objetivos:
-- 1. Revogar categoricamente permissões de leitura/escrita da role pública 'anon'
-- 2. Criar a função canônica app_private.is_active_internal_user()
-- 3. Substituir políticas permissivas USING (true) por validação de membro ativo
-- 4. Blindar o bucket 'documentos' no storage para acesso exclusivo de membros ativos
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GARANTIR QUE RLS ESTEJA ATIVADO EM TODAS AS TABELAS OPERACIONAIS
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comite_pauta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. REVOGAR PRIVILÉGIOS DA ROLE PÚBLICA 'anon' NO SCHEMA PUBLIC
-- Impede qualquer consulta direta sem autenticação legítima na API REST/PostgREST
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Garante que authenticated tenha permissão básica de uso (filtrado pelo RLS)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO CANÔNICA DE VERIFICAÇÃO DE COLABORADOR ATIVO (app_private)
-- Executa com SECURITY DEFINER para evitar recursão infinita no RLS de profiles
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.is_active_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ativo = true
      AND status_convite = 'ativo'
  );
$$;

-- Permissões estritas da função
REVOKE ALL ON FUNCTION app_private.is_active_internal_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_active_internal_user() FROM anon;
GRANT EXECUTE ON FUNCTION app_private.is_active_internal_user() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. TABELA: public.projetos
-- Substitui "USING (true)" por validação de membro ativo da Orizon
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "projetos_select_authenticated" ON public.projetos;
DROP POLICY IF EXISTS "projetos_select_internal_active" ON public.projetos;

CREATE POLICY "projetos_select_internal_active"
  ON public.projetos FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 5. TABELA: public.documentos
-- Documentos de M&A e teses visíveis apenas por colaboradores ativos
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "documentos_select_authenticated" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_internal_active" ON public.documentos;

CREATE POLICY "documentos_select_internal_active"
  ON public.documentos FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 6. TABELA: public.comentarios
-- Discussões internas acessíveis exclusivamente por colaboradores ativos
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "comentarios_select_authenticated" ON public.comentarios;
DROP POLICY IF EXISTS "comentarios_select_internal_active" ON public.comentarios;

CREATE POLICY "comentarios_select_internal_active"
  ON public.comentarios FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 7. TABELA: public.atividades (Audit Log)
-- Histórico e rastreabilidade protegidos contra contas inativas/anônimas
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "atividades_select_authenticated" ON public.atividades;
DROP POLICY IF EXISTS "atividades_select_internal_active" ON public.atividades;

CREATE POLICY "atividades_select_internal_active"
  ON public.atividades FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 8. TABELA: public.tarefas
-- Tarefas e prazos visíveis apenas para membros ativos da Orizon
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tarefas_select_authenticated" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_select_internal_active" ON public.tarefas;

CREATE POLICY "tarefas_select_internal_active"
  ON public.tarefas FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 9. STORAGE: storage.objects (Bucket "documentos")
-- Download e visualização de arquivos restritos a membros internos ativos
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_select_active" ON storage.objects;

CREATE POLICY "documentos_storage_select_active"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos'
    AND app_private.is_active_internal_user()
  );

-- ==============================================================================
-- FIM DA MIGRATION
-- ==============================================================================
