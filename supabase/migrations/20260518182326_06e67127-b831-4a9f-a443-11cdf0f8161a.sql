
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
