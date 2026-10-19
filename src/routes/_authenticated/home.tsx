import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PostCard, type PostWithMeta } from "@/components/PostCard";
import { StoriesRow } from "@/components/StoriesRow";
import { LiveRow } from "@/components/LiveRow";

import { Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  staticData: { sitemap: false },
  head: () => pageSEO("Home • VibeLink", "Your VibeLink feed of photos and creators.", "/home"),
  component: HomeFeed,
});

function HomeFeed() {
  const { user } = useAuth();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed", user?.id],
    queryFn: async (): Promise<PostWithMeta[]> => {
      const { data: postRows, error } = await supabase
        .from("posts")
        .select("id, user_id, image_url, caption, location, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!postRows?.length) return [];

      const userIds = [...new Set(postRows.map((p) => p.user_id))];
      const postIds = postRows.map((p) => p.id);

      const [{ data: profiles }, { data: likes }, { data: myLikes }, { data: comments }, { data: shares }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url, full_name, verified, verified_until").in("id", userIds),
        supabase.from("likes").select("post_id").in("post_id", postIds),
        user ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] as { post_id: string }[] }),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("post_shares").select("post_id").in("post_id", postIds),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const likeCount = new Map<string, number>();
      (likes ?? []).forEach((l) => likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1));
      const commentCount = new Map<string, number>();
      (comments ?? []).forEach((c) => commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1));
      const shareCount = new Map<string, number>();
      (shares ?? []).forEach((s) => shareCount.set(s.post_id, (shareCount.get(s.post_id) ?? 0) + 1));
      const myLikeSet = new Set((myLikes ?? []).map((l) => l.post_id));

      return postRows.map((p) => ({
        ...p,
        profile: profileMap.get(p.user_id) ?? null,
        likes_count: likeCount.get(p.id) ?? 0,
        comments_count: commentCount.get(p.id) ?? 0,
        shares_count: shareCount.get(p.id) ?? 0,
        liked_by_me: myLikeSet.has(p.id),
      }));
    },
  });

  return (
    <div>
      <LiveRow />
      <StoriesRow />
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading feed...</div>
      ) : !posts?.length ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto h-20 w-20 rounded-full border-2 border-foreground flex items-center justify-center">
            <Camera className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold">Share Photos</h2>
          <p className="mt-2 text-muted-foreground">When you share photos, they'll appear here.</p>
          <Link to="/create" className="inline-block mt-4 text-primary font-semibold">Share your first photo</Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
