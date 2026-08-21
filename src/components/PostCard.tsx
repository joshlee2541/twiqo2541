import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2, Link2, Share2, Archive } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SignedImage } from "./SignedImage";
import { UserAvatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Caption } from "./Caption";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";

export interface PostWithMeta {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  profile: { username: string; avatar_url: string | null; full_name: string | null; verified?: boolean | null; verified_until?: string | null } | null;
  likes_count: number;
  comments_count: number;
  shares_count?: number;
  liked_by_me: boolean;
}

const compact = (n: number) => Intl.NumberFormat("en", { notation: "compact" }).format(n);

export function PostCard({ post }: { post: PostWithMeta }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count);
  const [animatingHeart, setAnimatingHeart] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const isOwner = user?.id === post.user_id;

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false); setLikes((n) => n - 1);
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true); setLikes((n) => n + 1);
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (error && !error.message.includes("duplicate")) toast.error("Couldn't like");
    }
  };

  const doubleTap = () => {
    if (!liked) toggleLike();
    setAnimatingHeart(true);
    setTimeout(() => setAnimatingHeart(false), 700);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast.success("Link copied");
    } catch { toast.error("Couldn't copy link"); }
  };

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: "VibeLink post", url }); return; } catch { /* cancelled */ }
    }
    copyLink();
  };

  const doDelete = async () => {
    setConfirmOpen(false);
    setDeleted(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setDeleted(false);
      toast.error(error.message);
      return;
    }
    toast.success("Post deleted");
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["profile-posts"] });
  };

  if (deleted) return null;

  return (
    <article className="border-b border-border">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/profile/$username" params={{ username: post.profile?.username ?? "" }}>
          <UserAvatar path={post.profile?.avatar_url} username={post.profile?.username ?? ""} size={36} ring />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to="/profile/$username" params={{ username: post.profile?.username ?? "" }} className="text-sm font-semibold truncate flex items-center gap-1">
            <span className="truncate">{post.profile?.username}</span>
            <VerifiedBadge verified={post.profile?.verified} verifiedUntil={post.profile?.verified_until} />
          </Link>
          {post.location && <div className="text-xs text-muted-foreground truncate">{post.location}</div>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Post options" className="p-1 -mr-1 text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={copyLink}><Link2 className="h-4 w-4 mr-2" />Copy link</DropdownMenuItem>
            <DropdownMenuItem onSelect={share}><Share2 className="h-4 w-4 mr-2" />Share to…</DropdownMenuItem>
            {isOwner && (
              <>
                <DropdownMenuItem onSelect={() => toast("Archiving is coming soon")}>
                  <Archive className="h-4 w-4 mr-2" />Archive
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="relative bg-muted aspect-square w-full" onDoubleClick={doubleTap}>
        <SignedImage path={post.image_url} alt={post.caption ?? "Post"} className="w-full h-full object-cover" />
        {animatingHeart && (
          <Heart className="absolute inset-0 m-auto h-24 w-24 text-white drop-shadow-lg fill-white animate-ping" />
        )}
      </div>

      <div className="px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike} aria-label="Like" className="active:scale-90 transition-transform">
            <Heart className={cn("h-7 w-7", liked && "fill-[var(--like)] text-[var(--like)]")} />
          </button>
          <Link to="/post/$id" params={{ id: post.id }} aria-label="Comment">
            <MessageCircle className="h-7 w-7" />
          </Link>
          <button aria-label="Share" onClick={share}><Send className="h-7 w-7" /></button>
          <button aria-label="Save" className="ml-auto"><Bookmark className="h-7 w-7" /></button>
        </div>
        <div className="text-sm font-semibold mt-2">{likes.toLocaleString()} {likes === 1 ? "like" : "likes"}</div>
        {post.caption && (
          <Caption
            text={post.caption}
            prefix={
              <Link to="/profile/$username" params={{ username: post.profile?.username ?? "" }} className="font-semibold mr-1">
                {post.profile?.username}
              </Link>
            }
          />
        )}
        {post.comments_count > 0 && (
          <Link to="/post/$id" params={{ id: post.id }} className="text-sm text-muted-foreground mt-1 block">
            View all {post.comments_count} comments
          </Link>
        )}
        <div className="text-[11px] text-muted-foreground mt-1">
          {timeAgo(post.created_at)}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
