
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
-- current_user_role precisa ser chamada por authenticated nas policies via SECURITY DEFINER, mas é executada no contexto da policy (postgres role). Mantemos sem execute para roles client.
