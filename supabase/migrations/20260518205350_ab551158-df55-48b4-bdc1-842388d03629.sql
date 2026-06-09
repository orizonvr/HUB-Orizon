
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
