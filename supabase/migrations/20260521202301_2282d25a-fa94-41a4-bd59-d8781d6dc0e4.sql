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