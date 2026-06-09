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