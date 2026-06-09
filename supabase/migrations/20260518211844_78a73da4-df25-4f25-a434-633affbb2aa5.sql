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