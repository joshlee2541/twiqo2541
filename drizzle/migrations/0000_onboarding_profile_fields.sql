ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS reply_visibility text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS mention_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS message_permission text NOT NULL DEFAULT 'everyone';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reply_visibility_check CHECK (reply_visibility IN ('everyone','following','off'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_mention_permission_check CHECK (mention_permission IN ('everyone','following','off'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_message_permission_check CHECK (message_permission IN ('everyone','following','off'));

-- Let a user record a notification addressed to themselves (used by the
-- onboarding welcome notification); recipients can already read/update/delete
-- their own rows.
CREATE POLICY "self inserts own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = recipient_id AND actor_id = auth.uid());

COMMENT ON COLUMN public.profiles.date_of_birth IS 'PRIVATE: never rendered publicly, onboarding-only field';