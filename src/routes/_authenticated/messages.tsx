import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages • VibeLink" }] }),
  component: MessagesList,
});

interface Row {
  id: string;
  other_id: string;
  username: string;
  avatar_url: string | null;
  last_message_at: string;
  preview: string | null;
}

function MessagesList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user1_id, user2_id, last_message_at")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (!convs?.length) { setRows([]); setLoading(false); return; }
    const others = convs.map((c) => c.user1_id === user.id ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", others);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", convs.map((c) => c.id))
      .order("created_at", { ascending: false });
    const lastMsg = new Map<string, string>();
    (msgs ?? []).forEach((m) => { if (!lastMsg.has(m.conversation_id)) lastMsg.set(m.conversation_id, m.content); });
    setRows(convs.map((c) => {
      const other = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const p = pmap.get(other);
      return {
        id: c.id, other_id: other,
        username: p?.username ?? "user",
        avatar_url: p?.avatar_url ?? null,
        last_message_at: c.last_message_at,
        preview: lastMsg.get(c.id) ?? null,
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

  return (
    <div>
      <h1 className="text-lg font-semibold px-4 py-3 border-b border-border">Messages</h1>
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : !rows.length ? (
        <div className="p-8 text-center text-muted-foreground">
          No conversations yet. Visit a profile and tap Message.
        </div>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-b border-border">
              <Link to="/messages/$id" params={{ id: r.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <UserAvatar path={r.avatar_url} username={r.username} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.username}</div>
                  <div className="text-sm text-muted-foreground truncate">{r.preview ?? "Say hi"}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
