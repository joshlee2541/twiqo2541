import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/timeAgo";
import { enablePush, disablePush, isPushEnabled, pushSupported } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/notifications")({
  staticData: { sitemap: false },
  head: () => pageSEO("Activity • VibeLink", "Your VibeLink notifications.", "/notifications"),
  component: Notifications,
});

type Row = {
  id: string; type: "like" | "comment" | "follow"; post_id: string | null; created_at: string; read: boolean;
  actor_id: string; actor?: { username: string; avatar_url: string | null } | null;
};

function PushToggle() {
  const { user } = useAuth();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { isPushEnabled().then(setOn); }, []);
  if (!pushSupported() || on === null) return null;
  const toggle = async () => {
    if (!user) return;
    if (on) { await disablePush(); setOn(false); toast.success("Push notifications turned off"); return; }
    const r = await enablePush(user.id);
    if (r.ok) { setOn(true); toast.success("Push notifications on"); } else toast.error(r.reason);
  };
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-border p-3">
      <Bell className="h-5 w-5" />
      <div className="flex-1 text-sm">
        <div className="font-semibold">Push notifications</div>
        <div className="text-muted-foreground text-xs">Get alerts for likes, comments and new followers.</div>
      </div>
      <button onClick={toggle} className={"rounded-lg px-3 py-1.5 text-sm font-semibold " + (on ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground")}>
        {on ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase.from("notifications" as never).select("id, type, post_id, created_at, read, actor_id")
        .order("created_at", { ascending: false }).limit(100);
      const rows = (data ?? []) as unknown as Row[];
      const ids = [...new Set(rows.map((r) => r.actor_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => { r.actor = map.get(r.actor_id) ?? null; });
      }
      return rows;
    },
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications" as never).update({ read: true } as never).eq("recipient_id", user.id).eq("read", false).then(() => {});
  }, [user, data.length]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return (
    <div>
      <h1 className="px-4 pt-4 text-xl font-bold">Notifications</h1>
      <PushToggle />
      {data.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Activity On Your Posts</h2>
          <p className="text-sm text-muted-foreground mt-2">When someone likes or comments on your posts, you'll see it here.</p>
        </div>
      ) : (
        <ul className="mt-2">
          {data.map((n) => {
            const name = n.actor?.username ?? "someone";
            const text = n.type === "like" ? "liked your post." : n.type === "comment" ? "commented on your post." : "started following you.";
            return (
              <li key={n.id}>
                <Link
                  to={n.post_id ? "/post/$id" : "/profile/$username"}
                  params={n.post_id ? { id: n.post_id } : { username: name }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <UserAvatar path={n.actor?.avatar_url} username={name} size={44} />
                  <p className="flex-1 text-sm">
                    <span className="font-semibold">{name}</span> {text}{" "}
                    <span className="text-muted-foreground">{timeAgo(n.created_at, { short: true })}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
