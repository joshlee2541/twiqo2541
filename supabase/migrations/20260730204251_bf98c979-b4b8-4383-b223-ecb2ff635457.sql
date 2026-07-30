CREATE OR REPLACE FUNCTION public.get_presence(_ids uuid[])
RETURNS TABLE (user_id uuid, last_seen_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.last_seen_at
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND p.show_activity_status = true
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid() AND me.show_activity_status = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_presence(uuid[]) TO authenticated;