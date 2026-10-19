import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ActiveLabel, OnlineDot } from "@/components/Presence";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Send, Mic, Phone, Video, Trash2, X, CornerUpLeft, Copy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadMedia, getSignedUrl } from "@/lib/storage";
import { toast } from "sonner";
import { timeAgo } from "@/lib/timeAgo";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  staticData: { sitemap: false },
  head: ({ params }) => pageSEO("Chat • VibeLink", "Your private VibeLink conversation.", `/messages/${encodeURIComponent(params.id)}`),
  component: Chat,
});

interface Msg {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  read_at: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  reply_to_id: string | null;
}

interface Reaction { message_id: string; user_id: string; emoji: string; }

const REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍", "👎", "🔥"];

function Chat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState<{ id: string; username: string; full_name: string | null; avatar_url: string | null; verified: boolean; verified_until: string | null; last_seen_at: string | null } | null>(null);
  const [group, setGroup] = useState<{ name: string; avatar_url: string | null; member_count: number } | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load conversation, other user / group, messages, reactions
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase.from("conversations")
        .select("user1_id, user2_id, is_group, name, avatar_url").eq("id", id).maybeSingle();
      if (!conv) return;
      if (conv.is_group) {
        const { count } = await supabase.from("conversation_members")
          .select("user_id", { count: "exact", head: true }).eq("conversation_id", id);
        setGroup({ name: conv.name ?? "Group", avatar_url: conv.avatar_url, member_count: count ?? 0 });
      } else {
        const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
        if (otherId) {
          const { data: p } = await supabase.from("profiles")
            .select("id, username, full_name, avatar_url, verified, verified_until, last_seen_at")
            .eq("id", otherId).maybeSingle();
          setOther(p);
        }
      }
      const { data: m } = await supabase.from("messages")
        .select("id, sender_id, content, created_at, read_at, attachment_url, attachment_type, reply_to_id")
        .eq("conversation_id", id).order("created_at");
      setMsgs(m ?? []);
      if (m?.length) {
        const { data: rx } = await supabase.from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", m.map((x) => x.id));
        setReactions(rx ?? []);
      }
      // Mark incoming as read
      await supabase.from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", id).neq("sender_id", user.id).is("read_at", null);
    })();
  }, [id, user]);

  // Realtime: new messages, read updates, reactions
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`msg-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Msg;
          setMsgs((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
          if (m.sender_id !== user.id) {
            await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((cur) => cur.map((x) => x.id === m.id ? m : x));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" },
        async () => {
          const ids = msgs.map((x) => x.id);
          if (!ids.length) return;
          const { data: rx } = await supabase.from("message_reactions")
            .select("message_id, user_id, emoji").in("message_id", ids);
          setReactions(rx ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user, msgs.length]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs]);

  const touch = async () => {
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
  };

  const sendText = async () => {
    const t = text.trim(); if (!t || !user) return;
    setText("");
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    const { error } = await supabase.from("messages").insert({
      conversation_id: id, sender_id: user.id, content: t, reply_to_id: reply,
    });
    if (error) { setText(t); toast.error(error.message); return; }
    touch();
  };

  const react = async (msgId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === msgId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("message_id", msgId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({ message_id: msgId, user_id: user.id, emoji });
    }
    setActionMsg(null);
  };

  const deleteMsg = async (m: Msg) => {
    if (!user || m.sender_id !== user.id) return;
    await supabase.from("messages").delete().eq("id", m.id);
    setMsgs((cur) => cur.filter((x) => x.id !== m.id));
    setActionMsg(null);
  };

  const copyMsg = async (m: Msg) => {
    if (m.content) await navigator.clipboard.writeText(m.content);
    toast.success("Copied");
    setActionMsg(null);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!user || blob.size < 100) return;
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
          const path = await uploadMedia(user.id, file);
          const { error } = await supabase.from("messages").insert({
            conversation_id: id, sender_id: user.id, attachment_url: path, attachment_type: "audio",
          });
          if (error) throw error;
          touch();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to send voice"); }
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch { toast.error("Microphone permission denied"); }
  };

  const stopRec = (cancel = false) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    const rec = mediaRecRef.current;
    if (!rec) return;
    if (cancel) {
      rec.ondataavailable = null;
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
    }
    rec.stop();
    mediaRecRef.current = null;
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const reactionsFor = (mid: string) => reactions.filter((r) => r.message_id === mid);
  const msgById = (mid: string | null) => msgs.find((m) => m.id === mid);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <Link to="/messages" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        {group ? (
          <>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{group.name}</div>
              <Link to="/messages/$id/info" params={{ id }} className="block text-[11px] text-muted-foreground hover:underline">
                {group.member_count} members · Tap for info
              </Link>
            </div>
            <Link to="/call/$id" params={{ id }} search={{ mode: "audio" }} className="p-2" aria-label="Audio call"><Phone className="h-5 w-5" /></Link>
            <Link to="/call/$id" params={{ id }} search={{ mode: "video" }} className="p-2" aria-label="Video call"><Video className="h-5 w-5" /></Link>
          </>
        ) : other && (
          <>
            <div className="relative">
              <UserAvatar path={other.avatar_url} username={other.username} size={36} />
              <OnlineDot userId={other.id} lastSeen={other.last_seen_at} size={10} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-1 truncate">
                {other.username}
                <VerifiedBadge verified={other.verified} verifiedUntil={other.verified_until} />
              </div>
              <ActiveLabel userId={other.id} lastSeen={other.last_seen_at} className="block text-[11px]" />
            </div>
            <Link to="/call/$id" params={{ id }} search={{ mode: "audio" }} className="p-2" aria-label="Audio call"><Phone className="h-5 w-5" /></Link>
            <Link to="/call/$id" params={{ id }} search={{ mode: "video" }} className="p-2" aria-label="Video call"><Video className="h-5 w-5" /></Link>
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {msgs.map((m, i) => {
          const mine = m.sender_id === user?.id;
          const reps = reactionsFor(m.id);
          const reply = m.reply_to_id ? msgById(m.reply_to_id) : null;
          const isLastMine = mine && i === msgs.length - 1;
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                onContextMenu={(e) => { e.preventDefault(); setActionMsg(m); }}
                onDoubleClick={() => setActionMsg(m)}
                className={cn("group max-w-[78%] px-3 py-2 rounded-2xl text-sm cursor-pointer",
                  mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}
              >
                {reply && (
                  <div className={cn("text-xs mb-1 px-2 py-1 rounded-md border-l-2",
                    mine ? "bg-primary/80 border-white/60" : "bg-background/70 border-primary")}>
                    <div className="opacity-70 text-[10px]">↪ Reply</div>
                    <div className="truncate max-w-[200px]">{reply.content ?? "Attachment"}</div>
                  </div>
                )}
                {m.attachment_type === "audio" ? <VoiceBubble path={m.attachment_url} /> : m.content}
              </div>
              {reps.length > 0 && (
                <div className={cn("flex gap-1 -mt-1.5 mb-1", mine ? "mr-2" : "ml-2")}>
                  {Array.from(new Set(reps.map((r) => r.emoji))).map((e) => {
                    const count = reps.filter((r) => r.emoji === e).length;
                    return (
                      <button key={e} onClick={() => react(m.id, e)}
                        className="bg-background border border-border rounded-full text-xs px-1.5 py-0.5 shadow-sm">
                        {e}{count > 1 && <span className="ml-0.5">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {isLastMine && (
                <div className="text-[10px] text-muted-foreground mt-0.5 mr-1">
                  {m.read_at ? "Seen" : "Delivered"} · {timeAgo(m.created_at, { short: true })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="border-t border-border px-3 py-2 flex items-center gap-2 bg-muted/40">
          <CornerUpLeft className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Replying to {replyTo.sender_id === user?.id ? "yourself" : other?.username}</div>
            <div className="text-sm truncate">{replyTo.content ?? "Attachment"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="border-t border-border p-2 flex items-center gap-2">
        {recording ? (
          <>
            <button onClick={() => stopRec(true)} className="p-2 text-destructive" aria-label="Cancel"><Trash2 className="h-5 w-5" /></button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-full">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm tabular-nums">{fmtTime(elapsed)}</span>
              <span className="text-xs text-muted-foreground ml-auto">Recording…</span>
            </div>
            <Button onClick={() => stopRec(false)} size="icon" className="rounded-full"><Send className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
            <Input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
              placeholder="Message..." className="rounded-full" autoFocus />
            {text.trim() ? (
              <Button onClick={sendText} size="icon" className="rounded-full"><Send className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={startRec} size="icon" variant="secondary" className="rounded-full" aria-label="Record voice"><Mic className="h-4 w-4" /></Button>
            )}
          </>
        )}
      </div>

      {/* Action sheet */}
      {actionMsg && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setActionMsg(null)}>
          <div className="bg-background w-full rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-around">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => react(actionMsg.id, e)} className="text-2xl active:scale-110 transition-transform">{e}</button>
              ))}
            </div>
            <div className="border-t border-border pt-2 grid grid-cols-3 gap-2">
              <button onClick={() => { setReplyTo(actionMsg); setActionMsg(null); }} className="flex flex-col items-center gap-1 py-2 hover:bg-accent rounded-lg">
                <CornerUpLeft className="h-5 w-5" /><span className="text-xs">Reply</span>
              </button>
              <button onClick={() => copyMsg(actionMsg)} className="flex flex-col items-center gap-1 py-2 hover:bg-accent rounded-lg">
                <Copy className="h-5 w-5" /><span className="text-xs">Copy</span>
              </button>
              {actionMsg.sender_id === user?.id && (
                <button onClick={() => deleteMsg(actionMsg)} className="flex flex-col items-center gap-1 py-2 hover:bg-accent rounded-lg text-destructive">
                  <Trash2 className="h-5 w-5" /><span className="text-xs">Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceBubble({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSignedUrl(path).then(setUrl); }, [path]);
  if (!url) return <span className="text-xs opacity-70">Loading voice…</span>;
  return <audio controls src={url} className="max-w-[220px] h-9" />;
}
