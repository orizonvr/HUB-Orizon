REVOKE EXECUTE ON FUNCTION app_private.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app_private.current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION app_private.current_user_role() TO authenticated;