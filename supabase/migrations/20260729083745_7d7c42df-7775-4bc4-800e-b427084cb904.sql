
CREATE TABLE public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  audience text not null default 'public',
  comments_enabled boolean not null default true,
  thumbnail_url text,
  status text not null default 'live',
  scheduled_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  peak_viewers integer not null default 0,
  total_viewers integer not null default 0,
  replay_url text,
  replay_saved boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_streams_select" ON public.live_streams FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_streams_insert" ON public.live_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live_streams_update" ON public.live_streams FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live_streams_delete" ON public.live_streams FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE TABLE public.live_viewers (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  unique (stream_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_viewers TO authenticated;
GRANT ALL ON public.live_viewers TO service_role;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_viewers_select" ON public.live_viewers FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_viewers_insert" ON public.live_viewers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_viewers_update" ON public.live_viewers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_viewers_delete" ON public.live_viewers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.live_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_comments TO authenticated;
GRANT ALL ON public.live_comments TO service_role;
ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_comments_select" ON public.live_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_comments_insert" ON public.live_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_comments_update" ON public.live_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT host_id FROM public.live_streams s WHERE s.id = stream_id))
  WITH CHECK (auth.uid() = user_id OR auth.uid() = (SELECT host_id FROM public.live_streams s WHERE s.id = stream_id));
CREATE POLICY "live_comments_delete" ON public.live_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = (SELECT host_id FROM public.live_streams s WHERE s.id = stream_id));

CREATE TABLE public.live_reactions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, DELETE ON public.live_reactions TO authenticated;
GRANT ALL ON public.live_reactions TO service_role;
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_reactions_select" ON public.live_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_reactions_insert" ON public.live_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_reactions_delete" ON public.live_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.live_guest_requests (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (stream_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_guest_requests TO authenticated;
GRANT ALL ON public.live_guest_requests TO service_role;
ALTER TABLE public.live_guest_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_guest_select" ON public.live_guest_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "live_guest_insert" ON public.live_guest_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_guest_update" ON public.live_guest_requests FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT host_id FROM public.live_streams s WHERE s.id = stream_id))
  WITH CHECK (auth.uid() = (SELECT host_id FROM public.live_streams s WHERE s.id = stream_id));
CREATE POLICY "live_guest_delete" ON public.live_guest_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_live_streams_status ON public.live_streams(status, started_at DESC);
CREATE INDEX idx_live_comments_stream ON public.live_comments(stream_id, created_at);
CREATE INDEX idx_live_viewers_stream ON public.live_viewers(stream_id);

ALTER TABLE public.live_comments REPLICA IDENTITY FULL;
ALTER TABLE public.live_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.live_viewers REPLICA IDENTITY FULL;
ALTER TABLE public.live_streams REPLICA IDENTITY FULL;
ALTER TABLE public.live_guest_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_guest_requests;
