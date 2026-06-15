import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["audio", "video"]).default("audio") });

export const Route = createFileRoute("/_authenticated/call/$id")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Call • VibeLink" }] }),
  component: CallScreen,
});

function CallScreen() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase.from("conversations").select("user1_id, user2_id").eq("id", id).maybeSingle();
      if (!conv) return;
      const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const { data: p } = await supabase.from("profiles").select("username, avatar_url").eq("id", otherId).maybeSingle();
      setOther(p);
    })();
  }, [id, user]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const end = () => navigate({ to: "/messages/$id", params: { id } });

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col">
      <div className="pt-16 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {mode === "video" && !videoOff ? (
          <div className="w-full max-w-sm aspect-[3/4] bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-zinc-400 text-sm">Video preview (demo)</span>
          </div>
        ) : (
          <UserAvatar path={other?.avatar_url ?? null} username={other?.username ?? "?"} size={140} />
        )}
        <div className="mt-6 text-2xl font-semibold">{other?.username ?? "..."}</div>
        <div className="mt-1 text-sm text-white/70">
          {mode === "video" ? "Video call" : "Voice call"} · {fmt(seconds)}
        </div>
        <Link to="/messages/$id" params={{ id }} className="mt-2 text-xs text-white/50 underline">
          Back to chat
        </Link>
      </div>

      <div className="pb-12 flex items-center justify-center gap-6">
        <button
          onClick={() => setMuted((m) => !m)}
          className="h-14 w-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20"
          aria-label="Toggle mic"
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        {mode === "video" && (
          <button
            onClick={() => setVideoOff((v) => !v)}
            className="h-14 w-14 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20"
            aria-label="Toggle video"
          >
            {videoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </button>
        )}
        <button
          onClick={end}
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
