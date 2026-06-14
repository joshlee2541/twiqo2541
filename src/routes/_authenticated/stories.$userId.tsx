import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SignedImage } from "@/components/SignedImage";
import { UserAvatar } from "@/components/Avatar";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stories/$userId")({
  head: () => ({ meta: [{ title: "Story • VibeLink" }] }),
  component: StoryViewer,
});

interface Story { id: string; media_url: string; created_at: string; }

function StoryViewer() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [idx, setIdx] = useState(0);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("stories").select("id, media_url, created_at").eq("user_id", userId).gt("expires_at", new Date().toISOString()).order("created_at"),
        supabase.from("profiles").select("username, avatar_url").eq("id", userId).maybeSingle(),
      ]);
      setStories(s ?? []);
      setProfile(p ?? null);
    })();
  }, [userId]);

  useEffect(() => {
    if (!stories[idx] || !user) return;
    supabase.from("story_views").insert({ story_id: stories[idx].id, viewer_id: user.id }).then(() => {});
    const t = setTimeout(() => {
      if (idx + 1 < stories.length) setIdx(idx + 1);
      else navigate({ to: "/home" });
    }, 5000);
    return () => clearTimeout(t);
  }, [idx, stories, user, navigate]);

  if (!stories.length) {
    return <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center text-muted-foreground">No stories</div>;
  }

  const cur = stories[idx];
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex gap-1 p-2">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div className={i < idx ? "h-full bg-white w-full" : i === idx ? "h-full bg-white animate-[grow_5s_linear]" : "h-full"} style={i === idx ? { animation: "grow 5s linear" } : {}} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <UserAvatar path={profile?.avatar_url} username={profile?.username ?? "?"} size={32} />
        <span className="font-semibold text-sm">{profile?.username}</span>
        <button onClick={() => navigate({ to: "/home" })} className="ml-auto p-1">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center" onClick={(e) => {
        const x = e.clientX;
        const half = window.innerWidth / 2;
        if (x < half) { if (idx > 0) setIdx(idx - 1); }
        else { if (idx + 1 < stories.length) setIdx(idx + 1); else navigate({ to: "/home" }); }
      }}>
        <SignedImage path={cur.media_url} className="max-h-full max-w-full object-contain" />
      </div>
      <style>{`@keyframes grow { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
