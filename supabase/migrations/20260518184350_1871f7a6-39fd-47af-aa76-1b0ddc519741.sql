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