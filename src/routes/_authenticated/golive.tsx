import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Radio, Users, Lock, Globe, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/golive")({
  staticData: { sitemap: false },
  head: () => pageSEO("Go live • VibeLink", "Start your VibeLink live broadcast.", "/golive"),
  component: GoLive,
});

const CATEGORIES = ["Chatting", "Music", "Gaming", "Q&A", "Fitness", "Cooking", "Beauty", "Education", "Sports"];
const AUDIENCES = [
  { key: "public", label: "Public", icon: Globe, hint: "Anyone on VibeLink" },
  { key: "followers", label: "Followers", icon: Users, hint: "Only people who follow you" },
  { key: "close_friends", label: "Close friends", icon: Star, hint: "Your close friends list" },
] as const;

function GoLive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [audience, setAudience] = useState<string>("public");
  const [commentsOn, setCommentsOn] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCamError(true));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Add a title for your live"); return; }
    setBusy(true);
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(0);
    const { data, error } = await supabase.from("live_streams").insert({
      host_id: user.id,
      title: title.trim(),
      category,
      audience,
      comments_enabled: commentsOn,
      status: "live",
    }).select("id").single();
    if (error || !data) {
      setBusy(false); setCountdown(null);
      toast.error(error?.message ?? "Could not start live");
      return;
    }
    navigate({ to: "/live/$id", params: { id: data.id } });
  };

  return (
    <div className="px-4 py-4 pb-10">
      <h1 className="text-lg font-semibold text-center mb-4">Go live</h1>

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[45vh] mx-auto">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        {camError && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6 text-sm text-white/70">
            Camera unavailable — you can still start the live and chat with viewers.
          </div>
        )}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="text-white text-7xl font-bold animate-in zoom-in">
              {countdown === 0 ? "LIVE" : countdown}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="Q&A with followers" className="mt-1" />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Category</label>
          <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${category === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Audience</label>
          <div className="mt-2 rounded-xl border border-border overflow-hidden">
            {AUDIENCES.map((a) => (
              <button key={a.key} onClick={() => setAudience(a.key)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0 text-left">
                <a.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm">{a.label}</span>
                  <span className="block text-xs text-muted-foreground">{a.hint}</span>
                </span>
                <span className={`h-4 w-4 rounded-full border-2 ${audience === a.key ? "border-primary bg-primary" : "border-border"}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <span className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" />Comments</span>
          <Switch checked={commentsOn} onCheckedChange={setCommentsOn} />
        </div>

        <Button onClick={start} disabled={busy} className="w-full h-12 font-semibold text-base">
          <Radio className="h-5 w-5 mr-2" />{busy ? "Starting…" : "Go Live"}
        </Button>
      </div>
    </div>
  );
}
