-- =============================================================
-- ENUMS
-- =============================================================
CREATE TYPE public.user_role AS ENUM ('admin', 'lider', 'analista', 'observador');
CREATE TYPE public.projeto_tipo AS ENUM ('ma', 'novos_negocios');
CREATE TYPE public.projeto_status AS ENUM ('ativo', 'pausado', 'concluido', 'arquivado', 'perdido');

-- =============================================================
-- UTIL: updated_at trigger
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- =============================================================
-- TABLE: profiles
-- id matches auth.users.id by convention (no hard FK, so we can
-- seed fictional users for the MVP phase).
-- =============================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo   TEXT NOT NULL,
  cargo           TEXT,
  email           TEXT NOT NULL UNIQUE,
  avatar_url      TEXT,
  role            public.user_role NOT NULL DEFAULT 'analista',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- SECURITY DEFINER: current_user_role
-- Avoids infinite recursion in RLS policies that need the
-- caller's role.
-- =============================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- =============================================================
-- TABLE: projetos
-- =============================================================
CREATE TABLE public.projetos (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                        public.projeto_tipo NOT NULL,
  nome                        TEXT NOT NULL,
  contraparte                 TEXT,
  setor                       TEXT,
  estagio                     TEXT NOT NULL,
  status                      public.projeto_status NOT NULL DEFAULT 'ativo',
  responsavel_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lider_id                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  descricao                   TEXT,
  tese                        TEXT,
  valor_estimado              NUMERIC(18,2),
  ebitda_alvo                 NUMERIC(18,2),
  multiplo_ev_ebitda          NUMERIC(8,2),
  sinergias_estimadas         NUMERIC(18,2),
  tir_estimada                NUMERIC(6,3),
  payback_anos                NUMERIC(5,2),
  capex_estimado              NUMERIC(18,2),
  receita_projetada_ano3      NUMERIC(18,2),
  tam                         NUMERIC(18,2),
  riscos                      TEXT,
  proximos_passos             TEXT,
  data_inicio                 DATE,
  data_fechamento_prevista    DATE,
  data_fechamento_real        DATE,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estagio_valido CHECK (
    (tipo = 'ma' AND estagio IN (
      'originacao','avaliacao_inicial','nda','proposta_nao_vinculante',
      'due_diligence','proposta_vinculante','negociacao_final',
      'assinatura','closing','integracao'
    ))
    OR
    (tipo = 'novos_negocios' AND estagio IN (
      'ideacao','validacao','business_case','aprovacao_comite',
      'estruturacao','implementacao','operacao'
    ))
  )
);

CREATE INDEX idx_projetos_tipo ON public.projetos(tipo);
CREATE INDEX idx_projetos_status ON public.projetos(status);
CREATE INDEX idx_projetos_estagio ON public.projetos(estagio);
CREATE INDEX idx_projetos_responsavel ON public.projetos(responsavel_id);

CREATE TRIGGER trg_projetos_updated_at
BEFORE UPDATE ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: comentarios
-- =============================================================
CREATE TABLE public.comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id  UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  autor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conteudo    TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comentarios_projeto ON public.comentarios(projeto_id);
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: documentos
-- =============================================================
CREATE TABLE public.documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id      UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  tipo            TEXT,
  url_storage     TEXT NOT NULL,
  tamanho_bytes   BIGINT,
  enviado_por     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_projeto ON public.documentos(projeto_id);
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE: atividades (audit log)
-- =============================================================
CREATE TABLE public.atividades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id  UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  autor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao        TEXT NOT NULL,
  detalhes    JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atividades_projeto ON public.atividades(projeto_id);
CREATE INDEX idx_atividades_criado_em ON public.atividades(criado_em DESC);
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- ---------- profiles ----------
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_self_or_admin"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------- projetos ----------
CREATE POLICY "projetos_select_authenticated"
  ON public.projetos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "projetos_insert_non_observador"
  ON public.projetos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() <> 'observador');

CREATE POLICY "projetos_update_owner_lider_admin"
  ON public.projetos FOR UPDATE TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR lider_id = auth.uid()
    OR public.current_user_role() = 'admin'
  )
  WITH CHECK (
    responsavel_id = auth.uid()
    OR lider_id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "projetos_delete_admin"
  ON public.projetos FOR DELETE TO authenticated
  USING (public.current_user_role() = 'admin');

-- ---------- comentarios ----------
CREATE POLICY "comentarios_select_authenticated"
  ON public.comentarios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "comentarios_insert_non_observador"
  ON public.comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.current_user_role() <> 'observador'
  );

CREATE POLICY "comentarios_update_author_or_admin"
  ON public.comentarios FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (autor_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "comentarios_delete_author_or_admin"
  ON public.comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.current_user_role() = 'admin');

-- ---------- documentos ----------
CREATE POLICY "documentos_select_authenticated"
  ON public.documentos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "documentos_insert_non_observador"
  ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (
    enviado_por = auth.uid()
    AND public.current_user_role() <> 'observador'
  );

CREATE POLICY "documentos_update_owner_or_admin"
  ON public.documentos FOR UPDATE TO authenticated
  USING (enviado_por = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (enviado_por = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "documentos_delete_owner_or_admin"
  ON public.documentos FOR DELETE TO authenticated
  USING (enviado_por = auth.uid() OR public.current_user_role() = 'admin');

-- ---------- atividades ----------
CREATE POLICY "atividades_select_authenticated"
  ON public.atividades FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "atividades_insert_authenticated"
  ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (
    (autor_id IS NULL OR autor_id = auth.uid())
    AND public.current_user_role() <> 'observador'
  );

-- =============================================================
-- STORAGE: bucket "documentos" (private)
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documentos_storage_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_storage_insert_non_observador"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND public.current_user_role() <> 'observador'
  );

CREATE POLICY "documentos_storage_update_owner_or_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (owner = auth.uid() OR public.current_user_role() = 'admin')
  );

CREATE POLICY "documentos_storage_delete_owner_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (owner = auth.uid() OR public.current_user_role() = 'admin')
  );