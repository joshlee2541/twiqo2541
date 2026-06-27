import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore • VibeLink" }] }),
  component: Explore,
});

type Tab = "top" | "accounts" | "tags" | "places" | "audio";
const TABS: { id: Tab; label: string }[] = [
  { id: "top", label: "For you" },
  { id: "accounts", label: "Accounts" },
  { id: "audio", label: "Audio" },
  { id: "tags", label: "Tags" },
  { id: "places", label: "Places" },
];

function Explore() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("top");

  const { data: posts } = useQuery({
    queryKey: ["explore"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id, image_url").order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["search-users", q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, verified")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      return data ?? [];
    },
    enabled: q.trim().length > 0,
  });

  const { data: tagPosts } = useQuery({
    queryKey: ["search-tags", q],
    queryFn: async () => {
      const s = q.replace(/^#/, "");
      if (!s.trim()) return [];
      const { data } = await supabase
        .from("posts")
        .select("id, image_url, caption")
        .ilike("caption", `%#${s}%`)
        .limit(60);
      return data ?? [];
    },
    enabled: q.trim().length > 0 && (tab === "tags" || tab === "top"),
  });

  const searching = q.trim().length > 0;

  return (
    <div className="py-3">
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9 bg-muted border-0 h-10 rounded-lg" />
        </div>
      </div>

      {searching && (
        <div className="flex gap-4 px-4 overflow-x-auto border-b border-border text-sm">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-3 -mb-px border-b-2 whitespace-nowrap ${tab === t.id ? "border-foreground font-semibold" : "border-transparent text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!searching && (
        <div className="grid grid-cols-3 gap-[2px]">
          {posts?.map((p) => (
            <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="aspect-square bg-muted">
              <SignedImage path={p.image_url} alt="" className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      )}

      {searching && (tab === "accounts" || tab === "top") && (
        <div className="px-2 pt-2">
          {users?.map((u) => (
            <Link key={u.id} to="/profile/$username" params={{ username: u.username }} className="flex items-center gap-3 p-3 hover:bg-muted rounded-md">
              <UserAvatar path={u.avatar_url} username={u.username} size={44} />
              <div className="min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1">{u.username}{u.verified && <span className="text-primary">✓</span>}</div>
                <div className="text-xs text-muted-foreground truncate">{u.full_name}</div>
              </div>
            </Link>
          ))}
          {tab === "accounts" && !users?.length && <div className="text-center text-sm text-muted-foreground py-8">No accounts found</div>}
        </div>
      )}

      {searching && (tab === "tags" || tab === "top") && (
        <>
          {tab === "top" && users?.length ? null : null}
          <div className="grid grid-cols-3 gap-[2px] mt-1">
            {tagPosts?.map((p) => (
              <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="aspect-square bg-muted">
                <SignedImage path={p.image_url} alt="" className="w-full h-full object-cover" />
              </Link>
            ))}
          </div>
          {tab === "tags" && !tagPosts?.length && <div className="text-center text-sm text-muted-foreground py-8">No posts for #{q.replace(/^#/, "")}</div>}
        </>
      )}

      {searching && tab === "audio" && (
        <div className="text-center text-sm text-muted-foreground py-12">Audio search coming soon</div>
      )}
      {searching && tab === "places" && (
        <div className="text-center text-sm text-muted-foreground py-12">Place search coming soon</div>
      )}
    </div>
  );
}
