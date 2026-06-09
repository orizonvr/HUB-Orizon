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