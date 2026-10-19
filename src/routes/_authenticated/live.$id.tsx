import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Heart, Send, Users, Radio, Mic, MicOff, Video, VideoOff, SwitchCamera,
  Share2, Pin, Trash2, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/live/$id")({
  staticData: { sitemap: false },
  head: ({ params }) => pageSEO("Live • VibeLink", "Watch a VibeLink live broadcast.", `/live/${encodeURIComponent(params.id)}`),
  component: LiveRoom,
});

interface Stream {
  id: string; host_id: string; title: string; category: string | null;
  status: string; comments_enabled: boolean; started_at: string; ended_at: string | null;
  peak_viewers: number; total_viewers: number; replay_saved: boolean;
}
interface Profile { id: string; username: string; avatar_url: string | null }
interface Comment { id: string; user_id: string; body: string; pinned: boolean; created_at: string }
interface GuestReq { id: string; user_id: string; status: string }

function LiveRoom() {
  const { id } = useParams({ from: "/_authenticated/live/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [stream, setStream] = useState<Stream | null>(null);
  const [host, setHost] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewers, setViewers] = useState(0);
  const [reactions, setReactions] = useState(0);
  const [hearts, setHearts] = useState<{ key: number; left: number; emoji: string }[]>([]);
  const [guestReqs, setGuestReqs] = useState<GuestReq[]>([]);
  const [text, setText] = useState("");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [endOpen, setEndOpen] = useState(false);
  const [summary, setSummary] = useState<null | {
    total: number; peak: number; comments: number; reactions: number; minutes: number;
  }>(null);

  const isHost = !!user && !!stream && user.id === stream.host_id;

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((i) => i && !profiles.has(i));
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", missing);
    if (data?.length) {
      setProfiles((cur) => {
        const next = new Map(cur);
        data.forEach((p) => next.set(p.id, p));
        return next;
      });
    }
  }, [profiles]);

  // Load stream + host
  useEffect(() => {
    supabase.from("live_streams").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) { toast.error("Live not found"); navigate({ to: "/home" }); return; }
      setStream(data as Stream);
      supabase.from("profiles").select("id, username, avatar_url").eq("id", data.host_id).maybeSingle()
        .then(({ data: p }) => p && setHost(p));
    });
  }, [id]);

  // Host camera
  useEffect(() => {
    if (!isHost || stream?.status !== "live") return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing }, audio: true })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        mediaRef.current?.getTracks().forEach((t) => t.stop());
        mediaRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isHost, facing, stream?.status]);

  useEffect(() => () => { mediaRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  useEffect(() => {
    mediaRef.current?.getAudioTracks().forEach((t) => { t.enabled = mic; });
  }, [mic]);
  useEffect(() => {
    mediaRef.current?.getVideoTracks().forEach((t) => { t.enabled = cam; });
  }, [cam]);

  // Join as viewer + heartbeat
  useEffect(() => {
    if (!user || !stream) return;
    const join = async () => {
      await supabase.from("live_viewers")
        .upsert({ stream_id: id, user_id: user.id, last_seen_at: new Date().toISOString(), left_at: null },
          { onConflict: "stream_id,user_id" });
    };
    join();
    const t = setInterval(() => {
      supabase.from("live_viewers").update({ last_seen_at: new Date().toISOString() })
        .eq("stream_id", id).eq("user_id", user.id).then(() => undefined);
    }, 20000);
    return () => {
      clearInterval(t);
      supabase.from("live_viewers").update({ left_at: new Date().toISOString() })
        .eq("stream_id", id).eq("user_id", user.id).then(() => undefined);
    };
  }, [user?.id, stream?.id]);

  const refreshCounts = useCallback(async () => {
    const since = new Date(Date.now() - 60000).toISOString();
    const [{ count: watching }, { count: total }, { count: reactCount }] = await Promise.all([
      supabase.from("live_viewers").select("id", { count: "exact", head: true })
        .eq("stream_id", id).is("left_at", null).gte("last_seen_at", since),
      supabase.from("live_viewers").select("id", { count: "exact", head: true }).eq("stream_id", id),
      supabase.from("live_reactions").select("id", { count: "exact", head: true }).eq("stream_id", id),
    ]);
    setViewers(watching ?? 0);
    setReactions(reactCount ?? 0);
    if (isHost && (watching ?? 0) > 0) {
      supabase.from("live_streams").update({
        peak_viewers: Math.max(stream?.peak_viewers ?? 0, watching ?? 0),
        total_viewers: total ?? 0,
      }).eq("id", id).then(() => undefined);
    }
  }, [id, isHost, stream?.peak_viewers]);

  // Comments + realtime
  useEffect(() => {
    if (!stream) return;
    const loadComments = async () => {
      const { data } = await supabase.from("live_comments")
        .select("id, user_id, body, pinned, created_at")
        .eq("stream_id", id).order("created_at", { ascending: true }).limit(200);
      setComments(data ?? []);
      fetchProfiles([...new Set((data ?? []).map((c) => c.user_id))]);
    };
    loadComments();
    refreshCounts();

    const ch = supabase.channel(`live-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_comments", filter: `stream_id=eq.${id}` }, loadComments)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_reactions", filter: `stream_id=eq.${id}` }, (p) => {
        const emoji = (p.new as { emoji?: string }).emoji ?? "❤️";
        popHeart(emoji);
        setReactions((n) => n + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_viewers", filter: `stream_id=eq.${id}` }, refreshCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams", filter: `id=eq.${id}` }, (p) => {
        setStream(p.new as Stream);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_guest_requests", filter: `stream_id=eq.${id}` }, loadGuests)
      .subscribe();

    const poll = setInterval(refreshCounts, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [stream?.id]);

  const loadGuests = useCallback(async () => {
    const { data } = await supabase.from("live_guest_requests")
      .select("id, user_id, status").eq("stream_id", id).eq("status", "pending");
    setGuestReqs(data ?? []);
    fetchProfiles([...new Set((data ?? []).map((g) => g.user_id))]);
  }, [id, fetchProfiles]);

  useEffect(() => { if (isHost) loadGuests(); }, [isHost]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [comments.length]);

  const popHeart = (emoji: string) => {
    const key = Date.now() + Math.random();
    setHearts((h) => [...h, { key, left: 10 + Math.random() * 60, emoji }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.key !== key)), 2600);
  };

  const sendComment = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const { error } = await supabase.from("live_comments").insert({ stream_id: id, user_id: user.id, body });
    if (error) toast.error(error.message);
  };

  const react = async (emoji: string) => {
    if (!user) return;
    popHeart(emoji);
    await supabase.from("live_reactions").insert({ stream_id: id, user_id: user.id, emoji });
  };

  const requestJoin = async () => {
    if (!user) return;
    const { error } = await supabase.from("live_guest_requests")
      .upsert({ stream_id: id, user_id: user.id, status: "pending" }, { onConflict: "stream_id,user_id" });
    toast[error ? "error" : "success"](error ? error.message : "Request sent to the host");
  };

  const answerGuest = async (reqId: string, status: "accepted" | "declined") => {
    await supabase.from("live_guest_requests").update({ status }).eq("id", reqId);
    loadGuests();
  };

  const togglePin = async (c: Comment) => {
    await supabase.from("live_comments").update({ pinned: !c.pinned }).eq("id", c.id);
  };
  const removeComment = async (c: Comment) => {
    await supabase.from("live_comments").delete().eq("id", c.id);
  };

  const share = async () => {
    const url = `${window.location.origin}/live/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: stream?.title ?? "Live", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* dismissed */ }
  };

  const endLive = async (saveReplay: boolean) => {
    const started = stream ? new Date(stream.started_at).getTime() : Date.now();
    const [{ count: total }, { count: cCount }, { count: rCount }] = await Promise.all([
      supabase.from("live_viewers").select("id", { count: "exact", head: true }).eq("stream_id", id),
      supabase.from("live_comments").select("id", { count: "exact", head: true }).eq("stream_id", id),
      supabase.from("live_reactions").select("id", { count: "exact", head: true }).eq("stream_id", id),
    ]);
    await supabase.from("live_streams").update({
      status: "ended",
      ended_at: new Date().toISOString(),
      replay_saved: saveReplay,
      total_viewers: total ?? 0,
    }).eq("id", id);
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    setEndOpen(false);
    setSummary({
      total: total ?? 0,
      peak: Math.max(stream?.peak_viewers ?? 0, viewers),
      comments: cCount ?? 0,
      reactions: rCount ?? 0,
      minutes: Math.max(1, Math.round((Date.now() - started) / 60000)),
    });
  };

  const deleteLive = async () => {
    await supabase.from("live_streams").delete().eq("id", id);
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    toast.success("Live deleted");
    navigate({ to: "/home" });
  };

  if (!stream) return <div className="p-10 text-center text-muted-foreground">Loading live…</div>;

  if (summary) {
    return (
      <div className="px-5 py-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center">Your live has ended</h1>
        <p className="text-center text-muted-foreground text-sm mt-1">{stream.title}</p>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Stat label="Total viewers" value={summary.total} />
          <Stat label="Peak viewers" value={summary.peak} />
          <Stat label="Comments" value={summary.comments} />
          <Stat label="Reactions" value={summary.reactions} />
          <Stat label="Duration" value={`${summary.minutes} min`} />
          <Stat label="Replay" value={stream.replay_saved ? "Saved" : "Not saved"} />
        </div>
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={share}>Share replay link</Button>
          <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/home" })}>Done</Button>
          <Button variant="ghost" className="w-full text-destructive" onClick={deleteLive}>Delete live</Button>
        </div>
      </div>
    );
  }

  const ended = stream.status === "ended";
  const pinned = comments.find((c) => c.pinned);

  return (
    <div className="relative -mx-0">
      <div className="relative bg-black rounded-none sm:rounded-2xl overflow-hidden" style={{ height: "70vh" }}>
        {isHost && !ended ? (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-800 to-black">
            <UserAvatar path={host?.avatar_url} username={host?.username ?? "host"} size={80} ring />
            <p className="text-white font-semibold">{host?.username}</p>
            <p className="text-white/60 text-sm px-8 text-center">
              {ended ? "This live has ended." : "Live video is streaming — join the conversation below."}
            </p>
          </div>
        )}

        {/* top bar */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2">
          <span className="bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-1 rounded">
            {ended ? "ENDED" : "LIVE"}
          </span>
          <span className="bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Users className="h-3 w-3" />{viewers}
          </span>
          <span className="bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Heart className="h-3 w-3" />{reactions}
          </span>
          <div className="flex-1" />
          <button onClick={share} className="p-2 rounded-full bg-black/50 text-white"><Share2 className="h-4 w-4" /></button>
          {isHost && !ended ? (
            <button onClick={() => setEndOpen(true)} className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold">Finish</button>
          ) : (
            <button onClick={() => navigate({ to: "/home" })} className="p-2 rounded-full bg-black/50 text-white"><X className="h-4 w-4" /></button>
          )}
        </div>

        {/* host controls */}
        {isHost && !ended && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            <CtrlBtn active={mic} onClick={() => setMic((v) => !v)} on={<Mic className="h-4 w-4" />} off={<MicOff className="h-4 w-4" />} />
            <CtrlBtn active={cam} onClick={() => setCam((v) => !v)} on={<Video className="h-4 w-4" />} off={<VideoOff className="h-4 w-4" />} />
            <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              className="p-2.5 rounded-full bg-black/50 text-white"><SwitchCamera className="h-4 w-4" /></button>
          </div>
        )}

        {/* floating hearts */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {hearts.map((h) => (
            <span key={h.key} className="absolute bottom-4 text-2xl animate-[float-up_2.4s_ease-out_forwards]"
              style={{ left: `${h.left}%` }}>{h.emoji}</span>
          ))}
        </div>
      </div>

      {/* host guest requests */}
      {isHost && guestReqs.length > 0 && (
        <div className="px-4 py-2 border-b border-border space-y-2">
          {guestReqs.map((g) => (
            <div key={g.id} className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">
                <b>{profiles.get(g.user_id)?.username ?? "Someone"}</b> wants to join your live.
              </span>
              <Button size="sm" onClick={() => answerGuest(g.id, "accepted")}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => answerGuest(g.id, "declined")}>Decline</Button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-b border-border">
        <h1 className="font-semibold">{stream.title}</h1>
        <p className="text-xs text-muted-foreground">
          {stream.category ?? "Live"} • hosted by{" "}
          <Link to="/profile/$username" params={{ username: host?.username ?? "" }} className="text-primary">
            @{host?.username}
          </Link>
        </p>
      </div>

      {pinned && (
        <div className="px-4 py-2 bg-accent/40 text-sm flex items-start gap-2 border-b border-border">
          <Pin className="h-3.5 w-3.5 mt-1 text-muted-foreground" />
          <span><b>{profiles.get(pinned.user_id)?.username ?? "user"}</b> {pinned.body}</span>
        </div>
      )}

      <div ref={listRef} className="max-h-[38vh] overflow-y-auto px-4 py-3 space-y-3">
        {!comments.length && <p className="text-sm text-muted-foreground">No comments yet — say hello 👋</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2 group">
            <UserAvatar path={profiles.get(c.user_id)?.avatar_url} username={profiles.get(c.user_id)?.username ?? "u"} size={28} />
            <p className="text-sm flex-1">
              <b className="mr-1">{profiles.get(c.user_id)?.username ?? "user"}</b>{c.body}
            </p>
            {isHost && (
              <span className="flex gap-1 opacity-60">
                <button onClick={() => togglePin(c)} aria-label="Pin comment"><Pin className="h-3.5 w-3.5" /></button>
                <button onClick={() => removeComment(c)} aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </div>
        ))}
      </div>

      {!ended && (
        <div className="sticky bottom-16 bg-background border-t border-border px-3 py-2 flex items-center gap-2">
          {stream.comments_enabled ? (
            <>
              <Input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendComment()}
                placeholder="Add a comment…" className="rounded-full bg-muted border-0" />
              <button onClick={sendComment} className="p-2 text-primary" aria-label="Send comment"><Send className="h-5 w-5" /></button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground flex-1">Comments are turned off.</p>
          )}
          <button onClick={() => react("❤️")} className="p-2" aria-label="Send heart"><Heart className="h-5 w-5 text-destructive" /></button>
          <button onClick={() => react("😂")} className="p-2 text-lg" aria-label="Send laugh">😂</button>
          {!isHost && (
            <button onClick={requestJoin} className="p-2 text-primary" aria-label="Request to join"><UserPlus className="h-5 w-5" /></button>
          )}
        </div>
      )}

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End live?</DialogTitle>
            <DialogDescription>
              Choose what happens to this broadcast. Saving the replay keeps it on your profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={() => endLive(true)}><Radio className="h-4 w-4 mr-2" />End & save replay</Button>
            <Button variant="secondary" className="w-full" onClick={() => endLive(false)}>End without saving</Button>
            <Button variant="ghost" className="w-full text-destructive" onClick={deleteLive}>Delete live</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function CtrlBtn({ active, onClick, on, off }: { active: boolean; onClick: () => void; on: React.ReactNode; off: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`p-2.5 rounded-full ${active ? "bg-black/50 text-white" : "bg-white text-black"}`}>
      {active ? on : off}
    </button>
  );
}
