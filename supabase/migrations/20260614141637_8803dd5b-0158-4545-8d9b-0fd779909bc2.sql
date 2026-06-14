
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  u1 uuid;
  u2 uuid;
  cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = other_user THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;
  IF auth.uid() < other_user THEN u1 := auth.uid(); u2 := other_user;
  ELSE u1 := other_user; u2 := auth.uid(); END IF;
  SELECT id INTO cid FROM public.conversations WHERE user1_id = u1 AND user2_id = u2;
  IF cid IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id) VALUES (u1, u2) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END;
$$;
