import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ActiveLabel, OnlineDot } from "@/components/Presence";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Grid3x3, Settings as SettingsIcon, LogOut, MessageCircle, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link as RLink } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} • VibeLink` }] }),
  component: Profile,
});

function Profile() {
  const { username } = useParams({ from: "/_authenticated/profile/$username" });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const [posts, followers, following] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", profile!.id),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile!.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile!.id),
      ]);
      return { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  const { data: posts } = useQuery({
    queryKey: ["profile-posts", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id, image_url").eq("user_id", profile!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, profile?.id],
    enabled: !!user && !!profile && user.id !== profile.id,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", user!.id).eq("following_id", profile!.id).maybeSingle();
      return !!data;
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="p-8 text-center">User not found</div>;

  const isMe = user?.id === profile.id;

  const toggleFollow = async () => {
    if (!user) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      if (error) { toast.error(error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["is-following"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
  };

  return (
    <div>
      {isMe && (
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="font-semibold text-base flex items-center gap-1">@{profile.username}<VerifiedBadge verified={profile.verified} verifiedUntil={profile.verified_until} /></div>
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2" aria-label="Open menu"><MoreHorizontal className="h-6 w-6" /></button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[320px]">
              <SheetHeader className="px-4 py-3 border-b border-border">
                <SheetTitle>Settings and activity</SheetTitle>
              </SheetHeader>
              <ProfileMenu onSignOut={() => signOut()} />
            </SheetContent>
          </Sheet>
        </div>
      )}
      <div className="px-4 py-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <UserAvatar path={profile.avatar_url} username={profile.username} size={86} />
            {!isMe && <OnlineDot userId={profile.id} size={16} />}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <Stat label="posts" value={stats?.posts ?? 0} />
            <Stat label="followers" value={stats?.followers ?? 0} />
            <Stat label="following" value={stats?.following ?? 0} />
          </div>
        </div>
        <div className="mt-4">
          <div className="font-semibold text-sm flex items-center gap-1">
            {profile.full_name}
            {!isMe && <VerifiedBadge verified={profile.verified} verifiedUntil={profile.verified_until} />}
          </div>
          {!isMe && <ActiveLabel userId={profile.id} className="block mt-0.5" />}
          {profile.bio && <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-primary block">{profile.website}</a>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          {isMe ? (
            <>
              <Link to="/edit-profile" className="flex-1">
                <Button variant="secondary" className="w-full h-9"><SettingsIcon className="h-4 w-4 mr-2" />Edit profile</Button>
              </Link>
              <Button variant="secondary" className="h-9 w-9 p-0" onClick={() => signOut()} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button onClick={toggleFollow} className={`flex-1 h-9 ${isFollowing ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}`}>
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                variant="secondary"
                className="h-9"
                onClick={async () => {
                  const { data, error } = await supabase.rpc("get_or_create_conversation", { other_user: profile.id });
                  if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
                  navigate({ to: "/messages/$id", params: { id: data as string } });
                }}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> Message
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border flex justify-center py-2">
        <Grid3x3 className="h-5 w-5" />
      </div>

      {posts?.length ? (
        <div className="grid grid-cols-3 gap-[2px]">
          {posts.map((p) => (
            <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="aspect-square bg-muted">
              <SignedImage path={p.image_url} alt="" className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12 text-sm">No posts yet</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ProfileMenu({ onSignOut }: { onSignOut: () => void }) {
  const items: { section: string; label: string; group: string }[] = [
    { group: "How you use VibeLink", section: "account-center", label: "Account Center" },
    { group: "Who can see your content", section: "privacy", label: "Account privacy" },
    { group: "Who can see your content", section: "close-friends", label: "Close friends" },
    { group: "Who can see your content", section: "blocked", label: "Blocked" },
    { group: "Who can see your content", section: "hide-story", label: "Hide story and live" },
    { group: "How others can interact with you", section: "messages", label: "Messages and story replies" },
    { group: "How others can interact with you", section: "tags", label: "Tags and mentions" },
    { group: "How others can interact with you", section: "comments", label: "Comments" },
    { group: "How others can interact with you", section: "sharing", label: "Sharing and reuse" },
    { group: "How others can interact with you", section: "restricted", label: "Restricted" },
    { group: "How others can interact with you", section: "hidden-words", label: "Hidden words" },
    { group: "What you see", section: "muted", label: "Muted accounts" },
    { group: "What you see", section: "suggested", label: "Suggested content" },
    { group: "What you see", section: "like-counts", label: "Like and share counts" },
    { group: "Your app and media", section: "notifications", label: "Notifications" },
    { group: "Your app and media", section: "time-management", label: "Time management" },
    { group: "Your app and media", section: "archiving", label: "Archiving and downloading" },
    { group: "Your app and media", section: "accessibility", label: "Accessibility and translations" },
    { group: "Your app and media", section: "language", label: "Language" },
    { group: "Your app and media", section: "data-usage", label: "Data usage and media quality" },
    { group: "Your app and media", section: "website-permissions", label: "Website permissions" },
    { group: "More info and support", section: "help", label: "Help" },
    { group: "More info and support", section: "about", label: "About" },
    { group: "Login", section: "security", label: "Password and security" },
  ];
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <div className="overflow-y-auto h-[calc(100vh-60px)] pb-6">
      <div className="px-4 py-3 border-b border-border">
        <RLink to="/settings" className="block text-sm font-semibold">Settings and privacy</RLink>
      </div>
      {groups.map((g) => (
        <div key={g} className="mt-2">
          <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">{g}</div>
          {items.filter((i) => i.group === g).map((i) => (
            <RLink key={i.section} to="/settings/$section" params={{ section: i.section }}
              className="block px-4 py-2.5 text-sm hover:bg-accent/40 border-b border-border/60">
              {i.label}
            </RLink>
          ))}
        </div>
      ))}
      <div className="px-4 mt-4">
        <button onClick={onSignOut} className="w-full text-sm font-semibold text-destructive py-3">
          Log out
        </button>
      </div>
    </div>
  );
}
