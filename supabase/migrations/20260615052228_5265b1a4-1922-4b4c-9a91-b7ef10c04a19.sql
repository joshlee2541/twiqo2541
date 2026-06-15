
-- Make conversation creation rock-solid
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u1 uuid; u2 uuid; cid uuid; me uuid;
BEGIN
  me := auth.uid();
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF me = other_user THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;
  IF me < other_user THEN u1 := me; u2 := other_user; ELSE u1 := other_user; u2 := me; END IF;
  SELECT id INTO cid FROM public.conversations WHERE user1_id = u1 AND user2_id = u2;
  IF cid IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id) VALUES (u1, u2) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END $$;

-- Message attachments (voice notes, images, video)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

-- Notes (Instagram-style 24h text status)
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_expires ON public.notes(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notes" ON public.notes
  FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "Users insert own notes" ON public.notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notes" ON public.notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- One active note per user: replace on insert
CREATE OR REPLACE FUNCTION public.replace_user_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.notes WHERE user_id = NEW.user_id AND id <> NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notes_one_active ON public.notes;
CREATE TRIGGER notes_one_active AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.replace_user_note();

-- User settings (privacy, notifications, theme etc — IG-style)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT false,
  show_activity_status boolean NOT NULL DEFAULT true,
  allow_message_requests boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'en',
  theme text NOT NULL DEFAULT 'light',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own settings" ON public.user_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.user_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
