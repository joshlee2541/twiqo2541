import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getSignedUrl } from "@/lib/storage";
import { UserAvatar } from "@/components/Avatar";
import { Heart, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reels")({
  staticData: { sitemap: false },
  head: () => pageSEO("Reels • VibeLink", "Watch reels on VibeLink.", "/reels"),
  component: ReelsFeed,
});

interface Reel {
  id: string; user_id: string; video_url: string; caption: string | null;
  profile: { username: string; avatar_url: string | null } | null;
  likes_count: number; liked_by_me: boolean;
}

function ReelsFeed() {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);

  useEffect(() => {
    (async () => {
      const { data: rs } = await supabase.from("reels").select("id, user_id, video_url, caption").order("created_at", { ascending: false }).limit(30);
      if (!rs?.length) { setReels([]); return; }
      const uids = [...new Set(rs.map((r) => r.user_id))];
      const ids = rs.map((r) => r.id);
      const [{ data: profiles }, { data: likes }, { data: mine }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url").in("id", uids),
        supabase.from("reel_likes").select("reel_id").in("reel_id", ids),
        user ? supabase.from("reel_likes").select("reel_id").in("reel_id", ids).eq("user_id", user.id) : Promise.resolve({ data: [] as { reel_id: string }[] }),
      ]);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const lc = new Map<string, number>();
      (likes ?? []).forEach((l) => lc.set(l.reel_id, (lc.get(l.reel_id) ?? 0) + 1));
      const mineSet = new Set((mine ?? []).map((l) => l.reel_id));
      setReels(rs.map((r) => ({
        ...r,
        profile: pmap.get(r.user_id) ?? null,
        likes_count: lc.get(r.id) ?? 0,
        liked_by_me: mineSet.has(r.id),
      })));
    })();
  }, [user]);

  return (
    <div className="bg-black -mx-4 sm:mx-0">
      <div className="fixed top-16 right-4 z-30">
        <Link to="/create-reel" className="bg-white text-black rounded-full p-2 shadow-lg inline-flex">
          <Plus className="h-5 w-5" />
        </Link>
      </div>
      {!reels.length ? (
        <div className="h-[80vh] flex items-center justify-center text-white">No reels yet. <Link to="/create-reel" className="ml-2 text-primary">Create one</Link></div>
      ) : (
        <div className="snap-y snap-mandatory overflow-y-auto h-[calc(100vh-3.5rem-4rem)]">
          {reels.map((r) => <ReelItem key={r.id} reel={r} />)}
        </div>
      )}
    </div>
  );
}

function ReelItem({ reel }: { reel: Reel }) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(reel.liked_by_me);
  const [count, setCount] = useState(reel.likes_count);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => { getSignedUrl(reel.video_url).then(setUrl); }, [reel.video_url]);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.6 });
    obs.observe(v);
    return () => obs.disconnect();
  }, [url]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false); setCount((c) => c - 1);
      await supabase.from("reel_likes").delete().match({ reel_id: reel.id, user_id: user.id });
    } else {
      setLiked(true); setCount((c) => c + 1);
      await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    }
  };

  return (
    <div className="relative snap-start h-[calc(100vh-3.5rem-4rem)] flex items-center justify-center">
      {url && <video ref={ref} src={url} loop playsInline className="h-full w-full object-cover" onClick={() => { const v = ref.current!; v.paused ? v.play() : v.pause(); }} />}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4 text-white">
        <button onClick={toggleLike} className="flex flex-col items-center">
          <Heart className={cn("h-7 w-7", liked && "fill-[var(--like)] text-[var(--like)]")} />
          <span className="text-xs">{count}</span>
        </button>
        <MessageCircle className="h-7 w-7" />
      </div>
      <div className="absolute left-3 right-16 bottom-4 text-white">
        {reel.profile && (
          <Link to="/profile/$username" params={{ username: reel.profile.username }} className="flex items-center gap-2 mb-1">
            <UserAvatar path={reel.profile.avatar_url} username={reel.profile.username} size={32} />
            <span className="font-semibold text-sm">{reel.profile.username}</span>
          </Link>
        )}
        {reel.caption && <p className="text-sm">{reel.caption}</p>}
      </div>
    </div>
  );
}
