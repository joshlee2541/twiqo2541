
-- ============ GROUP CHATS ============
ALTER TABLE public.conversations
  ALTER COLUMN user1_id DROP NOT NULL,
  ALTER COLUMN user2_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS conv_pair_order,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Re-add the pair order check only when NOT a group
ALTER TABLE public.conversations
  ADD CONSTRAINT conv_pair_order CHECK (is_group OR (user1_id IS NOT NULL AND user2_id IS NOT NULL AND user1_id < user2_id));

-- conversation_members for groups (and DMs we'll mirror via RPC later)
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of conversation? (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_conv_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = _conv AND (c.user1_id = _user OR c.user2_id = _user)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_conv_admin(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = _user AND role = 'admin'
  )
$$;

CREATE POLICY "Members view membership" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id, auth.uid()));

CREATE POLICY "Admins manage members" ON public.conversation_members
  FOR ALL TO authenticated
  USING (public.is_conv_admin(conversation_id, auth.uid()))
  WITH CHECK (public.is_conv_admin(conversation_id, auth.uid()));

CREATE POLICY "Member can leave self" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Update conversations RLS to include group members
DROP POLICY IF EXISTS "Participants view conversation" ON public.conversations;
DROP POLICY IF EXISTS "Participants update conversation" ON public.conversations;
CREATE POLICY "Participants view conversation" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id OR public.is_conv_member(id, auth.uid()));
CREATE POLICY "Participants update conversation" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id OR public.is_conv_admin(id, auth.uid()));

-- Update messages RLS to include group members
DROP POLICY IF EXISTS "Participants read messages" ON public.messages;
DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
DROP POLICY IF EXISTS "Recipients can mark read" ON public.messages;

CREATE POLICY "Participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id, auth.uid()));
CREATE POLICY "Participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conv_member(conversation_id, auth.uid()));
CREATE POLICY "Participants mark read" ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conv_member(conversation_id, auth.uid()));

-- RPC: create group
CREATE OR REPLACE FUNCTION public.create_group_conversation(_name text, _member_ids uuid[], _avatar_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  cid uuid;
  uid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  INSERT INTO public.conversations (is_group, name, avatar_url, created_by)
  VALUES (true, trim(_name), _avatar_url, me)
  RETURNING id INTO cid;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (cid, me, 'admin');

  IF _member_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY _member_ids LOOP
      IF uid <> me THEN
        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES (cid, uid, 'member') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN cid;
END $$;

-- RPC: add member (admin only)
CREATE OR REPLACE FUNCTION public.add_group_member(_conv uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_conv_admin(_conv, auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _user, 'member') ON CONFLICT DO NOTHING;
END $$;

-- RPC: remove member (admin only)
CREATE OR REPLACE FUNCTION public.remove_group_member(_conv uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_conv_admin(_conv, auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user;
END $$;

-- RPC: change role
CREATE OR REPLACE FUNCTION public.set_group_member_role(_conv uuid, _user uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_conv_admin(_conv, auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Bad role'; END IF;
  UPDATE public.conversation_members SET role = _role
  WHERE conversation_id = _conv AND user_id = _user;
END $$;

-- RPC: leave group
CREATE OR REPLACE FUNCTION public.leave_group(_conv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.conversation_members
  WHERE conversation_id = _conv AND user_id = auth.uid();
END $$;

-- RPC: update group meta (admin only)
CREATE OR REPLACE FUNCTION public.update_group_meta(_conv uuid, _name text, _avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_conv_admin(_conv, auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.conversations SET name = COALESCE(_name, name), avatar_url = COALESCE(_avatar_url, avatar_url)
  WHERE id = _conv AND is_group = true;
END $$;

GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_group_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_group_meta(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- ============ CALLS / CALL HISTORY ============
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('audio','video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','answered','missed','declined','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int
);
CREATE INDEX IF NOT EXISTS idx_calls_conv ON public.calls(conversation_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view calls" ON public.calls
  FOR SELECT TO authenticated
  USING (public.is_conv_member(conversation_id, auth.uid()));
CREATE POLICY "Members create calls" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND public.is_conv_member(conversation_id, auth.uid()));
CREATE POLICY "Members update calls" ON public.calls
  FOR UPDATE TO authenticated
  USING (public.is_conv_member(conversation_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
