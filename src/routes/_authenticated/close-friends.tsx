import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Check, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/close-friends")({
  staticData: { sitemap: false },
  head: () => pageSEO("Close friends • VibeLink", "Manage your VibeLink close friends.", "/close-friends"),
  component: CloseFriends,
});

function CloseFriends() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: me } = await supabase.from("profiles").select("close_friends_ids").eq("id", user.id).maybeSingle();
      setSelected(new Set(me?.close_friends_ids ?? []));
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const ids = (follows ?? []).map((f) => f.following_id);
      if (!ids.length) return;
      const { data: profs } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids);
      setPeople(profs ?? []);
    })();
  }, [user?.id]);

  const toggle = async (id: string) => {
    if (!user) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    const { error } = await supabase.from("profiles").update({ close_friends_ids: Array.from(next) }).eq("id", user.id);
    if (error) toast.error(error.message);
  };

  const filtered = people.filter((p) => {
    const s = q.trim().toLowerCase();
    return !s || p.username.toLowerCase().includes(s) || (p.full_name ?? "").toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Link to="/home" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold">Close friends</h1>
        <span className="text-sm text-primary font-semibold">{selected.size}</span>
      </div>
      <p className="px-4 py-3 text-xs text-muted-foreground">
        We don't send notifications when you edit your close friends list.
      </p>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9 rounded-full bg-muted border-none" />
        </div>
      </div>
      <ul>
        {filtered.map((p) => {
          const on = selected.has(p.id);
          return (
            <li key={p.id}>
              <button onClick={() => toggle(p.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                <UserAvatar path={p.avatar_url} username={p.username} size={48} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-semibold truncate">{p.username}</div>
                  {p.full_name && <div className="text-xs text-muted-foreground truncate">{p.full_name}</div>}
                </div>
                <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${on ? "bg-[#22c55e] border-[#22c55e]" : "border-muted-foreground/40"}`}>
                  {on && <Check className="h-3.5 w-3.5 text-white" />}
                </span>
              </button>
            </li>
          );
        })}
        {!filtered.length && <li className="text-center text-sm text-muted-foreground py-8">Follow people to add them to your close friends</li>}
      </ul>
    </div>
  );
}
