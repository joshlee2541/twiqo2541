CREATE TABLE public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
CREATE INDEX post_shares_post_id_idx ON public.post_shares(post_id);
GRANT SELECT, INSERT, DELETE ON public.post_shares TO authenticated;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shares are viewable by everyone" ON public.post_shares FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can record their own shares" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own shares" ON public.post_shares FOR DELETE TO authenticated USING (auth.uid() = user_id);