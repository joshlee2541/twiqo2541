import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { ChevronLeft, Phone, Video, PhoneIncoming, PhoneMissed, PhoneOutgoing, Users } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

export const Route = createFileRoute("/_authenticated/calls")({
  staticData: { sitemap: false },
  head: () => pageSEO("Calls • VibeLink", "Your VibeLink call history.", "/calls"),
  component: CallsHistory,
});

interface CallRow {
  id: string;
  conversation_id: string;
  caller_id: string;
  call_type: string;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  conv: { is_group: boolean; name: string | null; user1_id: string | null; user2_id: string | null; avatar_url: string | null } | null;
  other: { username: string; avatar_url: string | null } | null;
}

function CallsHistory() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from("calls")
        .select("id, conversation_id, caller_id, call_type, status, started_at, duration_seconds, conversations!inner(is_group, name, user1_id, user2_id, avatar_url)")
        .order("started_at", { ascending: false })
        .limit(80);
      if (!rows) { setLoading(false); return; }
      const otherIds = new Set<string>();
      rows.forEach((r: any) => {
        const c = r.conversations;
        if (!c.is_group) {
          const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          if (otherId) otherIds.add(otherId);
        }
      });
      const { data: profs } = otherIds.size
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", Array.from(otherIds))
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
      const final: CallRow[] = rows.map((r: any) => {
        const c = r.conversations;
        let other = null;
        if (!c.is_group) {
          const oid = c.user1_id === user.id ? c.user2_id : c.user1_id;
          other = oid ? pmap.get(oid) ?? null : null;
        }
        return { ...r, conv: c, other };
      });
      setCalls(final);
      setLoading(false);
    })();
  }, [user]);

  const fmtDur = (s: number | null) => {
    if (!s) return "";
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Link to="/messages" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold">Calls</h1>
      </div>
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : !calls.length ? (
        <div className="p-8 text-center text-muted-foreground">No calls yet.</div>
      ) : (
        <ul>
          {calls.map((c) => {
            const incoming = c.caller_id !== user?.id;
            const missed = c.status === "missed" || c.status === "declined";
            const Icon = missed ? PhoneMissed : incoming ? PhoneIncoming : PhoneOutgoing;
            const iconColor = missed ? "text-destructive" : "text-muted-foreground";
            const title = c.conv?.is_group ? (c.conv.name ?? "Group") : c.other?.username ?? "Unknown";
            return (
              <li key={c.id} className="border-b border-border">
                <Link to="/messages/$id" params={{ id: c.conversation_id }} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                  {c.conv?.is_group ? (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
                  ) : (
                    <UserAvatar path={c.other?.avatar_url ?? null} username={title} size={48} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${missed ? "text-destructive" : ""}`}>{title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon className={`h-3 w-3 ${iconColor}`} />
                      <span>{c.call_type === "video" ? "Video" : "Audio"}</span>
                      <span>·</span>
                      <span>{timeAgo(c.started_at, { short: true })}</span>
                      {c.duration_seconds ? <><span>·</span><span>{fmtDur(c.duration_seconds)}</span></> : null}
                    </div>
                  </div>
                  <Link
                    to="/call/$id"
                    params={{ id: c.conversation_id }}
                    search={{ mode: c.call_type === "video" ? "video" : "audio" }}
                    className="p-2"
                    aria-label="Call back"
                  >
                    {c.call_type === "video" ? <Video className="h-5 w-5 text-primary" /> : <Phone className="h-5 w-5 text-primary" />}
                  </Link>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
