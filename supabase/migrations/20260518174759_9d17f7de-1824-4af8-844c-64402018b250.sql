REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;