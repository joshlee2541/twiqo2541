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

function Explore() {
  const [q, setQ] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["explore"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id, image_url").order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      if (!q.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      return data ?? [];
    },
    enabled: q.trim().length > 0,
  });

  return (
    <div className="py-3">
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9 bg-muted border-0 h-10" />
        </div>
      </div>

      {q.trim() ? (
        <div className="px-2">
          {users?.length ? users.map((u) => (
            <Link key={u.id} to="/profile/$username" params={{ username: u.username }} className="flex items-center gap-3 p-3 hover:bg-muted rounded-md">
              <UserAvatar path={u.avatar_url} username={u.username} size={44} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{u.username}</div>
                <div className="text-xs text-muted-foreground truncate">{u.full_name}</div>
              </div>
            </Link>
          )) : <div className="text-center text-sm text-muted-foreground py-8">No users found</div>}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {posts?.map((p) => (
            <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="aspect-square bg-muted">
              <SignedImage path={p.image_url} alt="" className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
