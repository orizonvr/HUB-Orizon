-- =============================================================
-- Schema consolidado — OrizonVR Pipeline (orizon-deals)
-- Gerado de supabase/migrations/ EXCETO as 2 migrations de pg_cron/pg_net
-- (cron roda via GitHub Actions, nao via pg_cron no banco).
-- Rodar em banco VAZIO no SQL Editor do Supabase e Run.
-- =============================================================


-- ========== 20260518174741_d184e950-0023-41c1-bd1f-2fac03f0c5b2.sql ==========
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

-- ========== 20260518174759_9d17f7de-1824-4af8-844c-64402018b250.sql ==========
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;

-- ========== 20260518182326_06e67127-b831-4a9f-a443-11cdf0f8161a.sql ==========

-- 1) Coluna ativo em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- 2) Trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_role public.user_role;
  v_nome text;
  v_cargo text;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (
    SELECT id FROM auth.users
  );
  -- First real auth-backed user becomes admin
  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count <= 1 THEN
    v_role := 'admin';
  ELSE
    v_role := 'analista';
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', split_part(NEW.email, '@', 1));
  v_cargo := NEW.raw_user_meta_data ->> 'cargo';

  INSERT INTO public.profiles (id, nome_completo, cargo, email, role, ativo)
  VALUES (NEW.id, v_nome, v_cargo, NEW.email, v_role, true)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Ajusta política de seleção de profiles para esconder inativos (exceto admin/self)
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    ativo = true
    OR id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

-- 4) Políticas de Storage no bucket "documentos"
DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
CREATE POLICY "documentos_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
CREATE POLICY "documentos_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND public.current_user_role() <> 'observador');

DROP POLICY IF EXISTS "documentos_storage_update" ON storage.objects;
CREATE POLICY "documentos_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');

DROP POLICY IF EXISTS "documentos_storage_delete" ON storage.objects;
CREATE POLICY "documentos_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documentos');


-- ========== 20260518182349_5b645b67-865c-48cf-8c89-cce026dc7d75.sql ==========

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
-- current_user_role precisa ser chamada por authenticated nas policies via SECURITY DEFINER, mas é executada no contexto da policy (postgres role). Mantemos sem execute para roles client.


-- ========== 20260518184248_162b7024-e98f-4250-96c2-5d7ad4d047b1.sql ==========
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- Keep existing public/anonymous access only where it already existed; do not broaden auth-only functions to anonymous users.

-- ========== 20260518184350_1871f7a6-39fd-47af-aa76-1b0ddc519741.sql ==========
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.current_user_role() TO authenticated;

ALTER POLICY profiles_select_authenticated
ON public.profiles
USING ((ativo = true) OR (id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY profiles_insert_self_or_admin
ON public.profiles
WITH CHECK ((id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY profiles_update_self_or_admin
ON public.profiles
USING ((id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role))
WITH CHECK ((id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY profiles_delete_admin
ON public.profiles
USING (app_private.current_user_role() = 'admin'::public.user_role);

ALTER POLICY projetos_insert_non_observador
ON public.projetos
WITH CHECK (app_private.current_user_role() <> 'observador'::public.user_role);

ALTER POLICY projetos_update_owner_lider_admin
ON public.projetos
USING ((responsavel_id = auth.uid()) OR (lider_id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role))
WITH CHECK ((responsavel_id = auth.uid()) OR (lider_id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY projetos_delete_admin
ON public.projetos
USING (app_private.current_user_role() = 'admin'::public.user_role);

ALTER POLICY comentarios_insert_non_observador
ON public.comentarios
WITH CHECK ((autor_id = auth.uid()) AND (app_private.current_user_role() <> 'observador'::public.user_role));

ALTER POLICY comentarios_update_author_or_admin
ON public.comentarios
USING ((autor_id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role))
WITH CHECK ((autor_id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY comentarios_delete_author_or_admin
ON public.comentarios
USING ((autor_id = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY documentos_insert_non_observador
ON public.documentos
WITH CHECK ((enviado_por = auth.uid()) AND (app_private.current_user_role() <> 'observador'::public.user_role));

ALTER POLICY documentos_update_owner_or_admin
ON public.documentos
USING ((enviado_por = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role))
WITH CHECK ((enviado_por = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY documentos_delete_owner_or_admin
ON public.documentos
USING ((enviado_por = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role));

ALTER POLICY atividades_insert_authenticated
ON public.atividades
WITH CHECK (((autor_id IS NULL) OR (autor_id = auth.uid())) AND (app_private.current_user_role() <> 'observador'::public.user_role));

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ========== 20260518184433_3eccd36e-40b6-48a7-b57d-68efbc4f49ce.sql ==========
REVOKE EXECUTE ON FUNCTION app_private.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION app_private.current_user_role() TO authenticated;

-- ========== 20260518184544_0ae50260-5ed1-40d0-8093-ef18335f504c.sql ==========
ALTER POLICY documentos_storage_insert
ON storage.objects
WITH CHECK ((bucket_id = 'documentos'::text) AND (app_private.current_user_role() <> 'observador'::public.user_role));

ALTER POLICY documentos_storage_insert_non_observador
ON storage.objects
WITH CHECK ((bucket_id = 'documentos'::text) AND (app_private.current_user_role() <> 'observador'::public.user_role));

ALTER POLICY documentos_storage_update_owner_or_admin
ON storage.objects
USING ((bucket_id = 'documentos'::text) AND ((owner = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role)));

ALTER POLICY documentos_storage_delete_owner_or_admin
ON storage.objects
USING ((bucket_id = 'documentos'::text) AND ((owner = auth.uid()) OR (app_private.current_user_role() = 'admin'::public.user_role)));

-- ========== 20260518200312_f74c6a47-2f94-4ffb-9d88-9a7fc03996a3.sql ==========
-- 1. Add columns to projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS status_detalhado text;

-- 2. Update handle_new_user to link existing placeholder profile by email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_count int;
  v_role public.user_role;
  v_nome text;
  v_cargo text;
BEGIN
  -- Link by email to placeholder profile if it exists
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_id <> NEW.id THEN
      UPDATE public.profiles SET id = NEW.id, ativo = true WHERE id = v_existing_id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count <= 1 THEN
    v_role := 'admin';
  ELSE
    v_role := 'analista';
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', split_part(NEW.email, '@', 1));
  v_cargo := NEW.raw_user_meta_data ->> 'cargo';

  INSERT INTO public.profiles (id, nome_completo, cargo, email, role, ativo)
  VALUES (NEW.id, v_nome, v_cargo, NEW.email, v_role, true)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ========== 20260518200406_1fbd06d7-de39-4abb-8ace-7fc305aec8d4.sql ==========
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS estagio_valido;

ALTER TABLE public.projetos ADD CONSTRAINT estagio_valido CHECK (
  (tipo = 'ma' AND estagio IN (
    'analise_inicial','nda_preenchimento','nda_assinado','elaborando_nbo',
    'nbo_submetida','due_diligence','negociacao','opcao_compra_assinada',
    'assinatura_spa','pos_ma_integracao'
  ))
  OR
  (tipo = 'novos_negocios' AND estagio IN (
    'analise_viabilidade','discussoes_offtaker','negociacao',
    'aprovacao_comite','implementacao','operacao'
  ))
);

-- ========== 20260518202501_bc5dfc33-484e-472b-a9dd-f6dae296bc6e.sql ==========
ALTER TABLE public.projetos
  ADD COLUMN volume_ton_dia numeric,
  ADD COLUMN percentual_orizon numeric,
  ADD COLUMN valor_transacao_mm numeric,
  ADD COLUMN notas_estrategicas text;

ALTER TABLE public.projetos
  ADD CONSTRAINT percentual_orizon_range
  CHECK (percentual_orizon IS NULL OR (percentual_orizon >= 0 AND percentual_orizon <= 100));

-- ========== 20260518203807_1e945f8d-fb18-4434-8769-188330405115.sql ==========
ALTER TABLE public.projetos ADD COLUMN ebitda_2025 numeric;

-- ========== 20260518205350_ab551158-df55-48b4-bdc1-842388d03629.sql ==========

-- Status do convite
DO $$ BEGIN
  CREATE TYPE public.convite_status AS ENUM ('pendente', 'ativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_convite public.convite_status NOT NULL DEFAULT 'ativo';

-- Tabela de convites
CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_token ON public.convites(token);
CREATE INDEX IF NOT EXISTS idx_convites_profile ON public.convites(profile_id);

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS convites_select_admin ON public.convites;
CREATE POLICY convites_select_admin ON public.convites
  FOR SELECT TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role);

-- Atualiza trigger de novo usuário para também marcar convite como aceito
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_count int;
  v_role public.user_role;
  v_nome text;
  v_cargo text;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_id <> NEW.id THEN
      UPDATE public.profiles
        SET id = NEW.id, ativo = true, status_convite = 'ativo'
        WHERE id = v_existing_id;
      UPDATE public.convites
        SET usado_em = COALESCE(usado_em, now())
        WHERE profile_id = NEW.id AND usado_em IS NULL;
    ELSE
      UPDATE public.profiles
        SET ativo = true, status_convite = 'ativo'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count <= 1 THEN
    v_role := 'admin';
  ELSE
    v_role := 'analista';
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', split_part(NEW.email, '@', 1));
  v_cargo := NEW.raw_user_meta_data ->> 'cargo';

  INSERT INTO public.profiles (id, nome_completo, cargo, email, role, ativo, status_convite)
  VALUES (NEW.id, v_nome, v_cargo, NEW.email, v_role, true, 'ativo')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Marcar os 4 profiles placeholder como pendentes e criar convites
UPDATE public.profiles
  SET status_convite = 'pendente'
  WHERE email IN (
    'renan.dipardi@orizonvr.com.br',
    'vinicius.sansiviero@orizonvr.com.br',
    'felipe.ferla@orizonvr.com.br',
    'francisco.targino@orizonvr.com.br'
  );

INSERT INTO public.convites (profile_id, criado_por, expira_em)
SELECT p.id,
       (SELECT id FROM public.profiles WHERE email = 'ricardo.sarfatti@orizonvr.com.br' LIMIT 1),
       now() + interval '7 days'
FROM public.profiles p
WHERE p.email IN (
  'renan.dipardi@orizonvr.com.br',
  'vinicius.sansiviero@orizonvr.com.br',
  'felipe.ferla@orizonvr.com.br',
  'francisco.targino@orizonvr.com.br'
)
AND NOT EXISTS (
  SELECT 1 FROM public.convites c WHERE c.profile_id = p.id AND c.usado_em IS NULL
);


-- ========== 20260518210758_34197a6b-4edb-4420-a9f5-f63d2486eea3.sql ==========

-- ============== profiles: prevent role/status_convite escalation ==============
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role)
  WITH CHECK (app_private.current_user_role() = 'admin'::user_role);

CREATE POLICY profiles_update_self_safe ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status_convite = (SELECT status_convite FROM public.profiles WHERE id = auth.uid())
    AND ativo = (SELECT ativo FROM public.profiles WHERE id = auth.uid())
  );

-- ============== storage.objects: consolidate documentos policies ==============
DROP POLICY IF EXISTS documentos_storage_delete ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_delete_owner_or_admin ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update_owner_or_admin ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert_non_observador ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_select ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_select_authenticated ON storage.objects;

CREATE POLICY documentos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY documentos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND app_private.current_user_role() <> 'observador'::user_role
  );

CREATE POLICY documentos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (owner = auth.uid() OR app_private.current_user_role() = 'admin'::user_role)
  )
  WITH CHECK (
    bucket_id = 'documentos'
    AND (owner = auth.uid() OR app_private.current_user_role() = 'admin'::user_role)
  );

CREATE POLICY documentos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (owner = auth.uid() OR app_private.current_user_role() = 'admin'::user_role)
  );

-- ============== convites: explicit admin-only policies ==============
CREATE POLICY convites_insert_admin ON public.convites
  FOR INSERT TO authenticated
  WITH CHECK (app_private.current_user_role() = 'admin'::user_role);

CREATE POLICY convites_update_admin ON public.convites
  FOR UPDATE TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role)
  WITH CHECK (app_private.current_user_role() = 'admin'::user_role);

CREATE POLICY convites_delete_admin ON public.convites
  FOR DELETE TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role);


-- ========== 20260518211844_78a73da4-df25-4f25-a434-633affbb2aa5.sql ==========
-- 1. Remove duplicate helper function in public schema (canonical is app_private.current_user_role)
DROP FUNCTION IF EXISTS public.current_user_role();

-- 2. Tighten storage SELECT on 'documentos' bucket: block observadores; everyone else (admin/lider/analista) can read
DROP POLICY IF EXISTS documentos_storage_select ON storage.objects;
CREATE POLICY documentos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND app_private.current_user_role() <> 'observador'::public.user_role
  );

-- ========== 20260520130143_88bd97eb-2ad4-4175-b37c-a6d81d023ad8.sql ==========
-- Recreate FKs to profiles(id) with ON UPDATE CASCADE so the
-- handle_new_user trigger can repoint a placeholder profile's id
-- to the new auth user id without violating FK constraints.

ALTER TABLE public.convites
  DROP CONSTRAINT convites_profile_id_fkey,
  ADD CONSTRAINT convites_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.convites
  DROP CONSTRAINT convites_criado_por_fkey,
  ADD CONSTRAINT convites_criado_por_fkey
    FOREIGN KEY (criado_por) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.projetos
  DROP CONSTRAINT projetos_responsavel_id_fkey,
  ADD CONSTRAINT projetos_responsavel_id_fkey
    FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.projetos
  DROP CONSTRAINT projetos_lider_id_fkey,
  ADD CONSTRAINT projetos_lider_id_fkey
    FOREIGN KEY (lider_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.comentarios
  DROP CONSTRAINT comentarios_autor_id_fkey,
  ADD CONSTRAINT comentarios_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.documentos
  DROP CONSTRAINT documentos_enviado_por_fkey,
  ADD CONSTRAINT documentos_enviado_por_fkey
    FOREIGN KEY (enviado_por) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.atividades
  DROP CONSTRAINT atividades_autor_id_fkey,
  ADD CONSTRAINT atividades_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ========== 20260521135328_6ea8b02f-387b-477b-83d9-435b0f6a2b36.sql ==========

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


-- ========== 20260521182440_a2ad38cd-974d-4b95-a53f-8296382b6669.sql ==========
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

-- ========== 20260521193725_818ba95a-edbc-403c-8fc2-c5e92a19b298.sql ==========
ALTER TABLE public.profiles
ALTER COLUMN preferencias SET DEFAULT jsonb_build_object('email_notificacoes', true);

UPDATE public.profiles
SET preferencias = jsonb_build_object(
  'email_notificacoes',
  COALESCE((preferencias ->> 'email_notificacoes')::boolean,
           (preferencias ->> 'email_tarefa_atribuida')::boolean,
           false)
  OR COALESCE((preferencias ->> 'email_tarefa_vencendo')::boolean, false)
)
WHERE preferencias ? 'email_tarefa_atribuida'
   OR preferencias ? 'email_tarefa_vencendo'
   OR NOT (preferencias ? 'email_notificacoes');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_count int;
  v_role public.user_role;
  v_nome text;
  v_cargo text;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_id <> NEW.id THEN
      UPDATE public.profiles
        SET id = NEW.id, ativo = true, status_convite = 'ativo'
        WHERE id = v_existing_id;
      UPDATE public.convites
        SET usado_em = COALESCE(usado_em, now())
        WHERE profile_id = NEW.id AND usado_em IS NULL;
    ELSE
      UPDATE public.profiles
        SET ativo = true, status_convite = 'ativo'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count <= 1 THEN
    v_role := 'admin';
  ELSE
    v_role := 'analista';
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', split_part(NEW.email, '@', 1));
  v_cargo := NEW.raw_user_meta_data ->> 'cargo';

  INSERT INTO public.profiles (id, nome_completo, cargo, email, role, ativo, status_convite, preferencias)
  VALUES (
    NEW.id,
    v_nome,
    v_cargo,
    NEW.email,
    v_role,
    true,
    'ativo',
    jsonb_build_object('email_notificacoes', true)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ========== 20260521202301_2282d25a-fa94-41a4-bd59-d8781d6dc0e4.sql ==========
-- 1) Drop policy that depends on responsavel_id FIRST
DROP POLICY IF EXISTS tarefas_update_owner_responsavel_admin ON public.tarefas;

-- 2) Add new column, backfill, set NOT NULL
ALTER TABLE public.tarefas
  ADD COLUMN responsavel_ids uuid[];

UPDATE public.tarefas
  SET responsavel_ids = ARRAY[responsavel_id]
  WHERE responsavel_id IS NOT NULL;

ALTER TABLE public.tarefas
  ALTER COLUMN responsavel_ids SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_ids
  ON public.tarefas USING GIN (responsavel_ids);

-- 3) Drop legacy column
ALTER TABLE public.tarefas DROP COLUMN responsavel_id;

-- 4) Recreate update policy using ANY
CREATE POLICY tarefas_update_owner_responsavel_admin
  ON public.tarefas
  FOR UPDATE
  TO authenticated
  USING (
    (
      (criado_por_id = auth.uid())
      OR (auth.uid() = ANY (responsavel_ids))
      OR (app_private.current_user_role() = 'admin'::user_role)
    )
    AND (app_private.current_user_role() <> 'observador'::user_role)
  )
  WITH CHECK (
    (
      (criado_por_id = auth.uid())
      OR (auth.uid() = ANY (responsavel_ids))
      OR (app_private.current_user_role() = 'admin'::user_role)
    )
    AND (app_private.current_user_role() <> 'observador'::user_role)
  );

-- 5) notificacoes_enviadas
ALTER TABLE public.notificacoes_enviadas
  ADD COLUMN IF NOT EXISTS usuario_destino uuid;

UPDATE public.notificacoes_enviadas
  SET usuario_destino = responsavel_id_notificado
  WHERE usuario_destino IS NULL;

ALTER TABLE public.notificacoes_enviadas
  ALTER COLUMN usuario_destino SET NOT NULL;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notificacoes_enviadas'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.notificacoes_enviadas DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.notificacoes_enviadas
  ADD CONSTRAINT notificacoes_enviadas_unique_destino
  UNIQUE (tarefa_id, tipo, usuario_destino);

CREATE INDEX IF NOT EXISTS idx_notif_env_lookup
  ON public.notificacoes_enviadas (tarefa_id, tipo, usuario_destino);

-- 6) preferencias default
ALTER TABLE public.profiles
  ALTER COLUMN preferencias
  SET DEFAULT jsonb_build_object('email_notificacoes', true, 'view_tarefas_modo', 'kanban');

UPDATE public.profiles
  SET preferencias = COALESCE(preferencias, '{}'::jsonb)
                     || jsonb_build_object('view_tarefas_modo', 'kanban')
  WHERE NOT (preferencias ? 'view_tarefas_modo');

-- 7) handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_count int;
  v_role public.user_role;
  v_nome text;
  v_cargo text;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_id <> NEW.id THEN
      UPDATE public.profiles
        SET id = NEW.id, ativo = true, status_convite = 'ativo'
        WHERE id = v_existing_id;
      UPDATE public.convites
        SET usado_em = COALESCE(usado_em, now())
        WHERE profile_id = NEW.id AND usado_em IS NULL;
    ELSE
      UPDATE public.profiles
        SET ativo = true, status_convite = 'ativo'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count <= 1 THEN
    v_role := 'admin';
  ELSE
    v_role := 'analista';
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', split_part(NEW.email, '@', 1));
  v_cargo := NEW.raw_user_meta_data ->> 'cargo';

  INSERT INTO public.profiles (id, nome_completo, cargo, email, role, ativo, status_convite, preferencias)
  VALUES (
    NEW.id,
    v_nome,
    v_cargo,
    NEW.email,
    v_role,
    true,
    'ativo',
    jsonb_build_object('email_notificacoes', true, 'view_tarefas_modo', 'kanban')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ========== 20260524191759_9ada5a0f-87de-4511-9395-a21043ac5df5.sql ==========
-- Tabela comites
CREATE TABLE public.comites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  data timestamp with time zone NOT NULL,
  participante_ids uuid[] NOT NULL DEFAULT '{}',
  criado_por_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'preparacao' CHECK (status IN ('preparacao', 'realizado', 'cancelado')),
  ata_consolidada text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_comites_data ON public.comites(data);
CREATE INDEX idx_comites_participantes ON public.comites USING GIN(participante_ids);

CREATE TRIGGER trg_comites_updated_at
  BEFORE UPDATE ON public.comites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comites ENABLE ROW LEVEL SECURITY;

-- Tabela comite_pauta
CREATE TABLE public.comite_pauta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comite_id uuid NOT NULL REFERENCES public.comites(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  relator_id uuid REFERENCES public.profiles(id),
  briefing_snapshot jsonb,
  decisao text DEFAULT 'pendente' CHECK (decisao IN ('aprovado', 'aprovado_com_ressalvas', 'reprovado', 'adiado', 'pendente')),
  justificativa text,
  condicionantes text,
  estagio_sugerido text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (comite_id, projeto_id)
);

CREATE INDEX idx_comite_pauta_comite ON public.comite_pauta(comite_id);
CREATE INDEX idx_comite_pauta_projeto ON public.comite_pauta(projeto_id);

CREATE TRIGGER trg_comite_pauta_updated_at
  BEFORE UPDATE ON public.comite_pauta
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comite_pauta ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES comites =====
CREATE POLICY comites_select ON public.comites
  FOR SELECT TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        auth.uid() = ANY(participante_ids)
        OR criado_por_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comite_pauta cp
          JOIN public.projetos p ON p.id = cp.projeto_id
          WHERE cp.comite_id = comites.id AND p.responsavel_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comites_insert ON public.comites
  FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_id = auth.uid()
    AND app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role, 'analista'::user_role)
  );

CREATE POLICY comites_update ON public.comites
  FOR UPDATE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (app_private.current_user_role() = 'analista'::user_role AND criado_por_id = auth.uid())
  )
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (app_private.current_user_role() = 'analista'::user_role AND criado_por_id = auth.uid())
  );

CREATE POLICY comites_delete ON public.comites
  FOR DELETE TO authenticated
  USING (app_private.current_user_role() = 'admin'::user_role);

-- ===== POLICIES comite_pauta =====
CREATE POLICY comite_pauta_select ON public.comite_pauta
  FOR SELECT TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id
            AND (auth.uid() = ANY(c.participante_ids) OR c.criado_por_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.projetos p
          WHERE p.id = comite_pauta.projeto_id AND p.responsavel_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comite_pauta_insert ON public.comite_pauta
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role, 'analista'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.comites c
      WHERE c.id = comite_pauta.comite_id AND c.status = 'preparacao'
    )
  );

CREATE POLICY comite_pauta_update ON public.comite_pauta
  FOR UPDATE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        relator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id AND c.criado_por_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    OR (
      app_private.current_user_role() = 'analista'::user_role
      AND (
        relator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.comites c
          WHERE c.id = comite_pauta.comite_id AND c.criado_por_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY comite_pauta_delete ON public.comite_pauta
  FOR DELETE TO authenticated
  USING (
    app_private.current_user_role() IN ('admin'::user_role, 'lider'::user_role)
    AND EXISTS (
      SELECT 1 FROM public.comites c
      WHERE c.id = comite_pauta.comite_id AND c.status = 'preparacao'
    )
  );