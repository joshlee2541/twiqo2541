import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Send, Mic, Square, Phone, Video, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadMedia, getSignedUrl } from "@/lib/storage";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "Chat • VibeLink" }] }),
  component: Chat,
});

interface Msg {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
}

function Chat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState<{ id: string; username: string; avatar_url: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase.from("conversations").select("user1_id, user2_id").eq("id", id).maybeSingle();
      if (!conv) return;
      const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).maybeSingle();
      setOther(p);
      const { data: m } = await supabase.from("messages")
        .select("id, sender_id, content, created_at, attachment_url, attachment_type")
        .eq("conversation_id", id).order("created_at");
      setMsgs(m ?? []);
    })();
  }, [id, user]);

  useEffect(() => {
    const ch = supabase.channel(`msg-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => setMsgs((cur) => [...cur, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  const touch = async () => {
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
  };

  const sendText = async () => {
    const t = text.trim(); if (!t || !user) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, content: t });
    if (error) { setText(t); toast.error(error.message); return; }
    touch();
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
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to send voice");
        }
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <Link to="/messages" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        {other && (
          <>
            <UserAvatar path={other.avatar_url} username={other.username} size={36} />
            <span className="font-semibold flex-1">{other.username}</span>
            <Link to="/call/$id" params={{ id }} search={{ mode: "audio" }} className="p-2" aria-label="Audio call">
              <Phone className="h-5 w-5" />
            </Link>
            <Link to="/call/$id" params={{ id }} search={{ mode: "video" }} className="p-2" aria-label="Video call">
              <Video className="h-5 w-5" />
            </Link>
          </>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.sender_id === user?.id ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[75%] px-3 py-2 rounded-2xl text-sm",
              m.sender_id === user?.id ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
              {m.attachment_type === "audio" ? <VoiceBubble path={m.attachment_url} /> : m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-2 flex items-center gap-2">
        {recording ? (
          <>
            <button onClick={() => stopRec(true)} className="p-2 text-destructive" aria-label="Cancel">
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-full">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm tabular-nums">{fmtTime(elapsed)}</span>
              <span className="text-xs text-muted-foreground ml-auto">Recording…</span>
            </div>
            <Button onClick={() => stopRec(false)} size="icon" className="rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Input value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
              placeholder="Message..." className="rounded-full" />
            {text.trim() ? (
              <Button onClick={sendText} size="icon" className="rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={startRec} size="icon" variant="secondary" className="rounded-full" aria-label="Record voice">
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VoiceBubble({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSignedUrl(path).then(setUrl); }, [path]);
  if (!url) return <span className="text-xs opacity-70">Loading voice…</span>;
  return <audio controls src={url} className="max-w-[220px] h-9" />;
}
