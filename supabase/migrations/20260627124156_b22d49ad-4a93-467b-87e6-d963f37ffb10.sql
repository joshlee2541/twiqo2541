
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS close_friends_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_activity_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Existing users skip onboarding
UPDATE public.profiles SET onboarded = true WHERE onboarded = false;

-- Saved collections
CREATE TABLE IF NOT EXISTS public.saved_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_collections TO authenticated;
GRANT ALL ON public.saved_collections TO service_role;
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collections" ON public.saved_collections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.saved_collections(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved" ON public.saved_posts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
