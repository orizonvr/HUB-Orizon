GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;

-- Keep existing public/anonymous access only where it already existed; do not broaden auth-only functions to anonymous users.