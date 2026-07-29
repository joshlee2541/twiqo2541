import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "./Avatar";

interface LiveItem {
  id: string;
  title: string;
  host_id: string;
  username: string;
  avatar_url: string | null;
}

export function LiveRow() {
  const [items, setItems] = useState<LiveItem[]>([]);

  const load = async () => {
    const { data: streams } = await supabase
      .from("live_streams")
      .select("id, title, host_id")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(20);
    if (!streams?.length) { setItems([]); return; }
    const { data: profiles } = await supabase
      .from("profiles").select("id, username, avatar_url")
      .in("id", [...new Set(streams.map((s) => s.host_id))]);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setItems(streams.map((s) => ({
      id: s.id,
      title: s.title,
      host_id: s.host_id,
      username: pmap.get(s.host_id)?.username ?? "user",
      avatar_url: pmap.get(s.host_id)?.avatar_url ?? null,
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("live-row")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!items.length) return null;

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Radio className="h-3.5 w-3.5 text-destructive" /> Live now
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 py-3">
        {items.map((l) => (
          <Link key={l.id} to="/live/$id" params={{ id: l.id }} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
            <div className="relative">
              <div className="rounded-full p-[2px] bg-destructive">
                <div className="bg-background rounded-full p-[2px]">
                  <UserAvatar path={l.avatar_url} username={l.username} size={52} />
                </div>
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                LIVE
              </span>
            </div>
            <span className="text-xs truncate w-full text-center mt-1">{l.username}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
