
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
