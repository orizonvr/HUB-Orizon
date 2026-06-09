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