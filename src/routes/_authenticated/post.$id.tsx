import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostDetail,
});

function PostDetail() {
  const { id } = useParams({ from: "/_authenticated/post/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: post } = useQuery({
    queryKey: ["post", id, user?.id],
    queryFn: async (): Promise<PostWithMeta | null> => {
      const { data: p } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (!p) return null;
      const [{ data: profile }, { count: lc }, { count: cc }, myLike] = await Promise.all([
        supabase.from("profiles").select("username, avatar_url, full_name").eq("id", p.user_id).maybeSingle(),
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", id),
        user ? supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        ...p,
        profile: profile ?? null,
        likes_count: lc ?? 0,
        comments_count: cc ?? 0,
        liked_by_me: !!myLike.data,
      };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      if (!data?.length) return [];
      const uids = [...new Set(data.map((c) => c.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", uids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return data.map((c) => ({ ...c, profile: map.get(c.user_id) }));
    },
  });

  const send = async () => {
    if (!user || !text.trim()) return;
    const v = text.trim().slice(0, 500);
    setText("");
    const { error } = await supabase.from("comments").insert({ post_id: id, user_id: user.id, content: v });
    if (!error) qc.invalidateQueries({ queryKey: ["comments", id] });
  };

  if (!post) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div>
      <PostCard post={post} />
      <div className="px-4 py-3 space-y-3">
        {comments?.length ? comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <UserAvatar path={c.profile?.avatar_url} username={c.profile?.username ?? ""} size={32} />
            <div className="flex-1 text-sm">
              <span className="font-semibold mr-2">{c.profile?.username}</span>
              {c.content}
              <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
            </div>
          </div>
        )) : <div className="text-sm text-muted-foreground text-center py-6">No comments yet</div>}
      </div>
      <div className="sticky bottom-16 bg-background border-t border-border p-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => e.key === "Enter" && send()} />
        <Button onClick={send} disabled={!text.trim()}>Post</Button>
      </div>
    </div>
  );
}
