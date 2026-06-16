import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { OnlineDot } from "@/components/Presence";
import { timeAgo } from "@/lib/timeAgo";
import { Input } from "@/components/ui/input";
import { Search, SquarePen, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages • VibeLink" }] }),
  component: MessagesList,
});

interface Row {
  id: string;
  other_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  verified_until: string | null;
  last_seen_at: string | null;
  last_message_at: string;
  preview: string | null;
  unread: number;
  last_sender: string | null;
  last_read: boolean;
}

function MessagesList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id, last_message_at")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (!convs?.length) { setRows([]); setLoading(false); return; }
    const others = convs.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, verified, verified_until, last_seen_at")
      .in("id", others);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, content, attachment_type, sender_id, created_at, read_at")
      .in("conversation_id", convs.map((c) => c.id))
      .order("created_at", { ascending: false });
    const lastMsg = new Map<string, { content: string; sender: string; read: boolean }>();
    const unreadMap = new Map<string, number>();
    (msgs ?? []).forEach((m) => {
      if (!lastMsg.has(m.conversation_id)) {
        const preview = m.content ?? (m.attachment_type === "audio" ? "🎤 Voice message" : "Attachment");
        lastMsg.set(m.conversation_id, { content: preview, sender: m.sender_id, read: !!m.read_at });
      }
      if (m.sender_id !== user.id && !m.read_at) {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
      }
    });
    setRows(convs.map((c) => {
      const other = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const p = pmap.get(other);
      const lm = lastMsg.get(c.id);
      return {
        id: c.id, other_id: other,
        username: p?.username ?? "user",
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        verified: !!p?.verified,
        verified_until: p?.verified_until ?? null,
        last_seen_at: p?.last_seen_at ?? null,
        last_message_at: c.last_message_at,
        preview: lm?.content ?? null,
        unread: unreadMap.get(c.id) ?? 0,
        last_sender: lm?.sender ?? null,
        last_read: lm?.read ?? false,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("messages-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      r.username.toLowerCase().includes(needle) ||
      (r.full_name?.toLowerCase().includes(needle) ?? false) ||
      (r.preview?.toLowerCase().includes(needle) ?? false)
    );
  }, [rows, q]);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Link to="/home" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold flex-1">Messages</h1>
        <NewMessageButton />
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 rounded-full bg-muted border-none h-9"
          />
        </div>
      </div>
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : !filtered.length ? (
        <div className="p-8 text-center text-muted-foreground">
          {q ? "No matches." : "No conversations yet. Tap the pencil to start one."}
        </div>
      ) : (
        <ul>
          {filtered.map((r) => (
            <li key={r.id} className="border-b border-border">
              <Link to="/messages/$id" params={{ id: r.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <div className="relative">
                  <UserAvatar path={r.avatar_url} username={r.username} size={52} />
                  <OnlineDot lastSeen={r.last_seen_at} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold truncate">{r.username}</span>
                    <VerifiedBadge verified={r.verified} verifiedUntil={r.verified_until} />
                  </div>
                  <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <span className={r.unread > 0 ? "text-foreground font-medium" : ""}>
                      {r.last_sender === user?.id ? "You: " : ""}{r.preview ?? "Say hi"}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(r.last_message_at, { short: true })}</span>
                  </div>
                </div>
                {r.unread > 0 ? (
                  <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                    {r.unread}
                  </span>
                ) : r.last_sender === user?.id && r.last_read ? (
                  <span className="ml-auto text-xs text-muted-foreground">Seen</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewMessageButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; full_name: string | null; avatar_url: string | null; verified: boolean; verified_until: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, verified, verified_until")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, user]);

  const startChat = async (other: string) => {
    const { data, error } = await supabase.rpc("get_or_create_conversation", { other_user: other });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    navigate({ to: "/messages/$id", params: { id: data as string } });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2" aria-label="New message"><SquarePen className="h-6 w-6" /></button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader><SheetTitle>New message</SheetTitle></SheetHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input autoFocus placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-full bg-muted border-none" />
        </div>
        <ul className="flex-1 overflow-y-auto mt-3 -mx-6">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => startChat(r.id)} className="w-full flex items-center gap-3 px-6 py-2 hover:bg-accent/50">
                <UserAvatar path={r.avatar_url} username={r.username} size={44} />
                <div className="text-left">
                  <div className="font-semibold flex items-center gap-1">{r.username}<VerifiedBadge verified={r.verified} verifiedUntil={r.verified_until} /></div>
                  {r.full_name && <div className="text-xs text-muted-foreground">{r.full_name}</div>}
                </div>
              </button>
            </li>
          ))}
          {q && results.length === 0 && <li className="text-center text-sm text-muted-foreground py-4">No users found</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
