import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { OnlineDot } from "@/components/Presence";
import { timeAgo } from "@/lib/timeAgo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SquarePen, ChevronLeft, Users, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages • VibeLink" }] }),
  component: MessagesList,
});

interface Row {
  id: string;
  is_group: boolean;
  title: string;
  subtitle: string | null;
  avatar_url: string | null;
  username: string;
  verified: boolean;
  verified_until: string | null;
  last_seen_at: string | null;
  last_message_at: string;
  preview: string | null;
  unread: number;
  last_sender: string | null;
  last_read: boolean;
  member_count: number;
}

function MessagesList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    // DMs
    const { data: dms } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id, last_message_at, is_group, name, avatar_url")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq("is_group", false);
    // Groups via membership
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const groupIds = (memberships ?? []).map((m) => m.conversation_id);
    const { data: groups } = groupIds.length
      ? await supabase
          .from("conversations")
          .select("id, user1_id, user2_id, last_message_at, is_group, name, avatar_url")
          .in("id", groupIds)
          .eq("is_group", true)
      : { data: [] as any[] };

    const convs = [...(dms ?? []), ...(groups ?? [])].sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
    );
    if (!convs.length) { setRows([]); setLoading(false); return; }

    // Other-user lookup for DMs
    const otherIds = convs
      .filter((c) => !c.is_group)
      .map((c) => (c.user1_id === user.id ? c.user2_id : c.user1_id))
      .filter((x): x is string => !!x);
    const { data: profiles } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, verified, verified_until, last_seen_at")
          .in("id", otherIds)
      : { data: [] as any[] };
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Group member counts
    const groupConvIds = convs.filter((c) => c.is_group).map((c) => c.id);
    const { data: memberRows } = groupConvIds.length
      ? await supabase.from("conversation_members").select("conversation_id").in("conversation_id", groupConvIds)
      : { data: [] as { conversation_id: string }[] };
    const counts = new Map<string, number>();
    (memberRows ?? []).forEach((m) => counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1));

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

    setRows(convs.map((c): Row => {
      const lm = lastMsg.get(c.id);
      if (c.is_group) {
        return {
          id: c.id,
          is_group: true,
          title: c.name ?? "Group",
          subtitle: `${counts.get(c.id) ?? 0} members`,
          avatar_url: c.avatar_url,
          username: c.name ?? "Group",
          verified: false,
          verified_until: null,
          last_seen_at: null,
          last_message_at: c.last_message_at,
          preview: lm?.content ?? null,
          unread: unreadMap.get(c.id) ?? 0,
          last_sender: lm?.sender ?? null,
          last_read: lm?.read ?? false,
          member_count: counts.get(c.id) ?? 0,
        };
      }
      const other = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const p = other ? pmap.get(other) : undefined;
      return {
        id: c.id,
        is_group: false,
        title: p?.username ?? "user",
        subtitle: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        username: p?.username ?? "user",
        verified: !!p?.verified,
        verified_until: p?.verified_until ?? null,
        last_seen_at: p?.last_seen_at ?? null,
        last_message_at: c.last_message_at,
        preview: lm?.content ?? null,
        unread: unreadMap.get(c.id) ?? 0,
        last_sender: lm?.sender ?? null,
        last_read: lm?.read ?? false,
        member_count: 2,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("messages-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      r.title.toLowerCase().includes(needle) ||
      (r.subtitle?.toLowerCase().includes(needle) ?? false) ||
      (r.preview?.toLowerCase().includes(needle) ?? false),
    );
  }, [rows, q]);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Link to="/home" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold flex-1">Messages</h1>
        <Link to="/calls" className="p-2" aria-label="Call history"><Phone className="h-5 w-5" /></Link>
        <CreateGroupButton onCreated={load} />
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
                  {r.is_group ? (
                    <div className="h-[52px] w-[52px] rounded-full bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  ) : (
                    <>
                      <UserAvatar path={r.avatar_url} username={r.username} size={52} />
                      <OnlineDot lastSeen={r.last_seen_at} />
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold truncate">{r.title}</span>
                    {!r.is_group && <VerifiedBadge verified={r.verified} verifiedUntil={r.verified_until} />}
                    {r.is_group && <span className="text-xs text-muted-foreground">· {r.member_count}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
                    <span className={r.unread > 0 ? "text-foreground font-medium" : ""}>
                      {r.last_sender === user?.id ? "You: " : ""}{r.preview ?? (r.is_group ? "New group" : "Say hi")}
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

interface PickUser { id: string; username: string; full_name: string | null; avatar_url: string | null; }

function CreateGroupButton({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickUser[]>([]);
  const [picked, setPicked] = useState<PickUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, user]);

  const toggle = (p: PickUser) => {
    setPicked((cur) => cur.find((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]);
  };

  const create = async () => {
    if (!name.trim() || picked.length === 0) { toast.error("Add a name and at least one member"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group_conversation", {
      _name: name.trim(),
      _member_ids: picked.map((p) => p.id),
      _avatar_url: undefined,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false); setName(""); setPicked([]); setQ(""); setResults([]);
    onCreated();
    navigate({ to: "/messages/$id", params: { id: data as string } });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2" aria-label="Create group"><Users className="h-5 w-5" /></button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader><SheetTitle>Create group</SheetTitle></SheetHeader>
        <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} className="mt-3" />
        {picked.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {picked.map((p) => (
              <button key={p.id} onClick={() => toggle(p)} className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm flex items-center gap-1">
                {p.username} ✕
              </button>
            ))}
          </div>
        )}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Add members" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-full bg-muted border-none" />
        </div>
        <ul className="flex-1 overflow-y-auto mt-3 -mx-6">
          {results.map((r) => {
            const isPicked = picked.some((p) => p.id === r.id);
            return (
              <li key={r.id}>
                <button onClick={() => toggle(r)} className="w-full flex items-center gap-3 px-6 py-2 hover:bg-accent/50">
                  <UserAvatar path={r.avatar_url} username={r.username} size={40} />
                  <div className="text-left flex-1">
                    <div className="font-semibold">{r.username}</div>
                    {r.full_name && <div className="text-xs text-muted-foreground">{r.full_name}</div>}
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 ${isPicked ? "bg-primary border-primary" : "border-muted-foreground"}`} />
                </button>
              </li>
            );
          })}
        </ul>
        <Button onClick={create} disabled={busy || !name.trim() || !picked.length} className="mt-3 rounded-full">
          Create group ({picked.length})
        </Button>
      </SheetContent>
    </Sheet>
  );
}
