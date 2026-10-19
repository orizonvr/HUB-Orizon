-- ==============================================================================
-- MIGRATION: 20261019153000_fase3_tarefas_colaboracao.sql
-- FASE 3: Novas Funcionalidades e Colaboração
--
-- Objetivos:
-- 1. Adicionar colunas de dependência e tipo em public.tarefas
-- 2. Criar tabela public.tarefas_comentarios (Chat estilo WhatsApp)
-- 3. Migrar observações legadas (descricao) para primeiro comentário
-- 4. Criar tabela public.tarefas_subtarefas (Checklist rápido)
-- 5. Criar tabela public.pipeline_estagios (Colunas dinâmicas no Kanban)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CAMPOS DE DEPENDÊNCIA E TIPO NA TABELA TAREFAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS dependencia_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dependencia_terceiro BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) NOT NULL DEFAULT 'tarefa';

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_tarefas_dependencia_id ON public.tarefas(dependencia_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_tipo ON public.tarefas(tipo);

-- ------------------------------------------------------------------------------
-- 2. TABELA: public.tarefas_comentarios (Chat estilo WhatsApp)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id),
  conteudo TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_comentarios_tarefa_criado
  ON public.tarefas_comentarios(tarefa_id, criado_em ASC);

ALTER TABLE public.tarefas_comentarios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tarefas_comentarios FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_comentarios TO authenticated;

DROP POLICY IF EXISTS "tarefas_comentarios_select_active" ON public.tarefas_comentarios;
CREATE POLICY "tarefas_comentarios_select_active"
  ON public.tarefas_comentarios FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

DROP POLICY IF EXISTS "tarefas_comentarios_insert_active" ON public.tarefas_comentarios;
CREATE POLICY "tarefas_comentarios_insert_active"
  ON public.tarefas_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (app_private.is_active_internal_user() AND autor_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3. MIGRAÇÃO DE DADOS: Observações legadas (descricao) -> Primeiro comentário
-- ------------------------------------------------------------------------------
INSERT INTO public.tarefas_comentarios (tarefa_id, autor_id, conteudo, criado_em)
SELECT
  t.id AS tarefa_id,
  t.criado_por_id AS autor_id,
  t.descricao AS conteudo,
  t.created_at AS criado_em
FROM public.tarefas t
WHERE t.descricao IS NOT NULL
  AND TRIM(t.descricao) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.tarefas_comentarios c WHERE c.tarefa_id = t.id
  );

-- ------------------------------------------------------------------------------
-- 4. TABELA: public.tarefas_subtarefas (Checklist de Subtarefas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas_subtarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  concluida BOOLEAN NOT NULL DEFAULT FALSE,
  concluida_em TIMESTAMPTZ,
  criado_por_id UUID REFERENCES public.profiles(id),
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_subtarefas_tarefa_ordem
  ON public.tarefas_subtarefas(tarefa_id, ordem ASC);

ALTER TABLE public.tarefas_subtarefas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tarefas_subtarefas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_subtarefas TO authenticated;

DROP POLICY IF EXISTS "tarefas_subtarefas_select_active" ON public.tarefas_subtarefas;
CREATE POLICY "tarefas_subtarefas_select_active"
  ON public.tarefas_subtarefas FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

DROP POLICY IF EXISTS "tarefas_subtarefas_modify_active" ON public.tarefas_subtarefas;
CREATE POLICY "tarefas_subtarefas_modify_active"
  ON public.tarefas_subtarefas FOR ALL
  TO authenticated
  USING (app_private.is_active_internal_user())
  WITH CHECK (app_private.is_active_internal_user());

-- ------------------------------------------------------------------------------
-- 5. TABELA: public.pipeline_estagios (Colunas dinâmicas no Kanban)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) NOT NULL, -- 'ma' | 'novos_negocios'
  chave VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  cor VARCHAR(50),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pipeline_estagios_tipo_chave UNIQUE (tipo, chave)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_estagios_tipo_ordem
  ON public.pipeline_estagios(tipo, ordem ASC);

ALTER TABLE public.pipeline_estagios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_estagios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_estagios TO authenticated;

DROP POLICY IF EXISTS "pipeline_estagios_select_active" ON public.pipeline_estagios;
CREATE POLICY "pipeline_estagios_select_active"
  ON public.pipeline_estagios FOR SELECT
  TO authenticated
  USING (app_private.is_active_internal_user());

DROP POLICY IF EXISTS "pipeline_estagios_modify_priv" ON public.pipeline_estagios;
CREATE POLICY "pipeline_estagios_modify_priv"
  ON public.pipeline_estagios FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider')));

-- Carga inicial de estágios padrão para M&A
INSERT INTO public.pipeline_estagios (tipo, chave, label, ordem) VALUES
  ('ma', 'analise_inicial', 'Análise Inicial', 1),
  ('ma', 'nda_preenchimento', 'NDA em preenchimento', 2),
  ('ma', 'nda_assinado', 'NDA assinado', 3),
  ('ma', 'elaborando_nbo', 'Elaborando NBO', 4),
  ('ma', 'nbo_submetida', 'NBO submetida', 5),
  ('ma', 'due_diligence', 'Due Diligence', 6),
  ('ma', 'negociacao', 'Negociação', 7),
  ('ma', 'opcao_compra_assinada', 'Opção de Compra Assinada', 8),
  ('ma', 'assinatura_spa', 'Assinatura do SPA', 9),
  ('ma', 'pos_ma_integracao', 'Pós-M&A / Integração', 10)
ON CONFLICT (tipo, chave) DO NOTHING;

-- Carga inicial de estágios padrão para Novos Negócios
INSERT INTO public.pipeline_estagios (tipo, chave, label, ordem) VALUES
  ('novos_negocios', 'discussoes_iniciais', 'Discussões Iniciais', 1),
  ('novos_negocios', 'modelagem_inicial', 'Modelagem Inicial', 2),
  ('novos_negocios', 'discussoes_offtaker', 'Discussões com Offtaker', 3),
  ('novos_negocios', 'discussoes_fornecedores', 'Discussões com Fornecedores', 4),
  ('novos_negocios', 'materiais_finais', 'Materiais Finais', 5),
  ('novos_negocios', 'implementacao', 'Implementação', 6),
  ('novos_negocios', 'operacao', 'Operação', 7),
  ('novos_negocios', 'paralisados', 'Paralisados', 8)
ON CONFLICT (tipo, chave) DO NOTHING;
