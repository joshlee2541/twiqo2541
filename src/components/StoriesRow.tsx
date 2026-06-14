import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "./Avatar";
import { uploadMedia } from "@/lib/storage";
import { toast } from "sonner";

interface StoryUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  latest: string;
}

export function StoriesRow() {
  const { user } = useAuth();
  const [users, setUsers] = useState<StoryUser[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data: stories } = await supabase
      .from("stories")
      .select("user_id, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (!stories?.length) { setUsers([]); return; }
    const uids = [...new Set(stories.map((s) => s.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", uids);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setUsers(uids.map((uid) => {
      const p = pmap.get(uid);
      return {
        user_id: uid,
        username: p?.username ?? "user",
        avatar_url: p?.avatar_url ?? null,
        latest: stories.find((s) => s.user_id === uid)!.created_at,
      };
    }));
  };

  useEffect(() => { load(); }, []);

  const onPick = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !user) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setBusy(true);
    try {
      const path = await uploadMedia(user.id, f);
      const { error } = await supabase.from("stories").insert({ user_id: user.id, media_url: path, media_type: "image" });
      if (error) throw error;
      toast.success("Story posted!");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="border-b border-border">
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <div className="flex gap-3 overflow-x-auto px-4 py-3">
        <button onClick={onPick} disabled={busy} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
          <div className="relative">
            <UserAvatar path={null} username={user?.email ?? "Y"} size={56} />
            <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
              <Plus className="h-3 w-3" />
            </span>
          </div>
          <span className="text-xs truncate w-full text-center">Your story</span>
        </button>
        {users.map((u) => (
          <Link key={u.user_id} to="/stories/$userId" params={{ userId: u.user_id }} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
            <UserAvatar path={u.avatar_url} username={u.username} size={56} ring />
            <span className="text-xs truncate w-full text-center">{u.username}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
