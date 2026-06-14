import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "Chat • VibeLink" }] }),
  component: Chat,
});

interface Msg { id: string; sender_id: string; content: string; created_at: string; }

function Chat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState<{ id: string; username: string; avatar_url: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conv } = await supabase.from("conversations").select("user1_id, user2_id").eq("id", id).maybeSingle();
      if (!conv) return;
      const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const { data: p } = await supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).maybeSingle();
      setOther(p);
      const { data: m } = await supabase.from("messages").select("id, sender_id, content, created_at").eq("conversation_id", id).order("created_at");
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

  const send = async () => {
    const t = text.trim(); if (!t || !user) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, content: t });
    if (error) { setText(t); return; }
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <Link to="/messages" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        {other && (
          <>
            <UserAvatar path={other.avatar_url} username={other.username} size={36} />
            <span className="font-semibold">{other.username}</span>
          </>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.sender_id === user?.id ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[75%] px-3 py-2 rounded-2xl text-sm",
              m.sender_id === user?.id ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-2 flex items-center gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Message..." className="rounded-full" />
        <Button onClick={send} disabled={!text.trim()} size="icon" className="rounded-full">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
