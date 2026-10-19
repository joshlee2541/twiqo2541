import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX, Bluetooth,
  SwitchCamera, MonitorUp, Users,
} from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["audio", "video"]).default("audio") });

export const Route = createFileRoute("/_authenticated/call/$id")({
  validateSearch: searchSchema,
  staticData: { sitemap: false },
  head: ({ params }) => pageSEO("Call • VibeLink", "Manage your VibeLink audio or video call.", `/call/${encodeURIComponent(params.id)}`),
  component: CallScreen,
});

interface OtherInfo { title: string; avatar_url: string | null; is_group: boolean; }

function CallScreen() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<OtherInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [bluetooth, setBluetooth] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const callIdRef = useRef<string | null>(null);
  const startedRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user1_id, user2_id, is_group, name, avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (!conv) return;
      if (conv.is_group) {
        setInfo({ title: conv.name ?? "Group call", avatar_url: conv.avatar_url, is_group: true });
      } else {
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        if (!otherId) return;
        const { data: p } = await supabase.from("profiles").select("username, avatar_url").eq("id", otherId).maybeSingle();
        if (p) setInfo({ title: p.username, avatar_url: p.avatar_url, is_group: false });
      }
      // Record call start
      const { data: call } = await supabase
        .from("calls")
        .insert({ conversation_id: id, caller_id: user.id, call_type: mode, status: "answered" })
        .select("id")
        .single();
      if (call) callIdRef.current = call.id;
    })();
  }, [id, user, mode]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const end = async () => {
    if (callIdRef.current) {
      const dur = Math.floor((Date.now() - startedRef.current) / 1000);
      await supabase.from("calls").update({
        status: "ended", ended_at: new Date().toISOString(), duration_seconds: dur,
      }).eq("id", callIdRef.current);
    }
    navigate({ to: "/messages/$id", params: { id } });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col">
      <div className="pt-16 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {mode === "video" && !videoOff ? (
          <div className="w-full max-w-sm aspect-[3/4] bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 relative">
            <span className="text-zinc-400 text-sm">{screenShare ? "Screen sharing (demo)" : "Video preview (demo)"}</span>
            <div className="absolute bottom-3 right-3 w-20 h-28 bg-zinc-700 rounded-lg flex items-center justify-center text-[10px] text-zinc-400">You</div>
          </div>
        ) : info?.is_group ? (
          <div className="h-[140px] w-[140px] rounded-full bg-gradient-to-br from-primary/40 to-accent flex items-center justify-center">
            <Users className="h-16 w-16 text-white/90" />
          </div>
        ) : (
          <UserAvatar path={info?.avatar_url ?? null} username={info?.title ?? "?"} size={140} />
        )}
        <div className="mt-6 text-2xl font-semibold">{info?.title ?? "…"}</div>
        <div className="mt-1 text-sm text-white/70">
          {mode === "video" ? "Video call" : "Voice call"} · {fmt(seconds)}
        </div>
        <Link to="/messages/$id" params={{ id }} className="mt-2 text-xs text-white/50 underline">
          Back to chat
        </Link>
      </div>

      {/* Device controls row */}
      <div className="pb-4 flex items-center justify-center gap-3 px-4 flex-wrap">
        <DeviceBtn active={speaker} onClick={() => setSpeaker((v) => !v)} label="Speaker">
          {speaker ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </DeviceBtn>
        <DeviceBtn active={bluetooth} onClick={() => setBluetooth((v) => !v)} label="Bluetooth">
          <Bluetooth className="h-5 w-5" />
        </DeviceBtn>
        {mode === "video" && (
          <>
            <DeviceBtn active={false} onClick={() => { /* demo */ }} label="Flip">
              <SwitchCamera className="h-5 w-5" />
            </DeviceBtn>
            <DeviceBtn active={screenShare} onClick={() => setScreenShare((v) => !v)} label="Share">
              <MonitorUp className="h-5 w-5" />
            </DeviceBtn>
          </>
        )}
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

function DeviceBtn({ children, active, onClick, label }: { children: React.ReactNode; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-11 w-11 rounded-full flex items-center justify-center ${active ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
