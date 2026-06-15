
REVOKE EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.replace_user_note() FROM PUBLIC, anon, authenticated;
