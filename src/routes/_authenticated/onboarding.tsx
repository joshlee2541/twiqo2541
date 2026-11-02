import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerPush } from "@/lib/push";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, Check, ChevronRight, Sparkles, Users, Bell, MessageCircle, Compass, Film } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  staticData: { sitemap: false },
  head: () => pageSEO("Welcome • Twiqo", "Set up your Twiqo account.", "/onboarding"),
  component: Onboarding,
});

const INTERESTS = [
  "Technology", "Gaming", "Sports", "Music", "Business", "Education",
  "Photography", "Fashion", "Food", "Travel", "Art", "Fitness",
  "Movies", "Comedy", "Nature", "Cars", "Books", "Crypto",
];

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Profile setup state
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [interests, setInterests] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null; followed?: boolean }>>([]);

  useEffect(() => {
    supabase.from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setSuggested(data ?? []));
  }, [user?.id]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !user) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    setAvatarPreview(URL.createObjectURL(f));
    try {
      const path = await uploadMedia(user.id, f);
      setAvatarPath(path);
    } catch { toast.error("Upload failed"); }
  };

  const toggleInterest = (t: string) =>
    setInterests((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);

  const toggleFollow = async (uid: string, followed: boolean) => {
    if (!user) return;
    if (followed) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", uid);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: uid });
      triggerPush();
    }
    setSuggested((s) => s.map((u) => u.id === uid ? { ...u, followed: !followed } : u));
  };

  const finish = async () => {
    if (!user) return;
    const updates: { onboarded: boolean; interests: string[]; avatar_url?: string; bio?: string; website?: string } = { onboarded: true, interests };
    if (avatarPath) updates.avatar_url = avatarPath;
    if (bio.trim()) updates.bio = bio.trim();
    if (website.trim()) updates.website = website.trim();
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome to Twiqo!");
    navigate({ to: "/home" });
  };

  const steps = [
    // 0 — Welcome
    <div key="welcome" className="flex flex-col items-center text-center px-6 py-12 gap-4">
      <img src="/icons/icon-512.png" alt="Twiqo" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-[24%] shadow-lg shadow-primary/20" />
      <h1 className="twiqo-logo text-4xl mt-2">Twiqo</h1>
      <p className="text-muted-foreground">Connect, share & discover your vibe.</p>
      <Button className="w-full max-w-xs h-11 mt-6 rounded-full" onClick={() => setStep(1)}>Get started</Button>
    </div>,

    // 1 — Profile photo + bio
    <div key="profile" className="px-6 py-8">
      <h2 className="text-2xl font-bold text-center">Set up your profile</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">Add a photo and short bio</p>
      <div className="flex justify-center mt-6">
        <button onClick={() => fileRef.current?.click()} className="relative">
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="h-28 w-28 rounded-full object-cover" />
          ) : (
            <UserAvatar path={null} username={user?.email ?? "U"} size={112} />
          )}
          <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 border-2 border-background">
            <Camera className="h-4 w-4" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
      </div>
      <div className="mt-6 space-y-3">
        <Textarea placeholder="Bio (e.g. Software dev | Tech enthusiast)" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={150} />
        <Input placeholder="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <Button className="w-full h-11 mt-6 rounded-full" onClick={() => setStep(2)}>Next</Button>
      <button onClick={() => setStep(2)} className="w-full text-center text-sm text-muted-foreground py-3">Skip for now</button>
    </div>,

    // 2 — Interests
    <div key="interests" className="px-6 py-8">
      <h2 className="text-2xl font-bold text-center">Pick your interests</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">We'll personalize your feed</p>
      <div className="flex flex-wrap gap-2 mt-6 justify-center">
        {INTERESTS.map((t) => {
          const active = interests.includes(t);
          return (
            <button key={t} onClick={() => toggleInterest(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
              {active && <Check className="h-3 w-3 inline mr-1" />}{t}
            </button>
          );
        })}
      </div>
      <Button disabled={interests.length < 3} className="w-full h-11 mt-8 rounded-full" onClick={() => setStep(3)}>
        Continue {interests.length > 0 && `(${interests.length})`}
      </Button>
      <p className="text-xs text-center text-muted-foreground mt-2">Pick at least 3</p>
    </div>,

    // 3 — Follow suggestions
    <div key="follow" className="px-4 py-6">
      <h2 className="text-2xl font-bold text-center px-2">Follow people to fill your feed</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">Suggested for you</p>
      <ul className="mt-6 space-y-1">
        {suggested.map((u) => (
          <li key={u.id} className="flex items-center gap-3 p-2 rounded-lg">
            <UserAvatar path={u.avatar_url} username={u.username} size={48} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{u.username}</div>
              <div className="text-xs text-muted-foreground truncate">{u.full_name ?? "On Twiqo"}</div>
            </div>
            <Button size="sm" variant={u.followed ? "secondary" : "default"} className="rounded-full h-8" onClick={() => toggleFollow(u.id, !!u.followed)}>
              {u.followed ? "Following" : "Follow"}
            </Button>
          </li>
        ))}
        {!suggested.length && <li className="text-center text-sm text-muted-foreground py-6">No suggestions yet</li>}
      </ul>
      <Button className="w-full h-11 mt-6 rounded-full" onClick={() => setStep(4)}>Next</Button>
    </div>,

    // 4 — Tutorial
    <div key="tutorial" className="px-6 py-8">
      <h2 className="text-2xl font-bold text-center">You're all set</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">Here's what you can do</p>
      <div className="mt-8 space-y-4">
        <TutorialRow icon={<Sparkles className="h-5 w-5" />} title="Create posts" body="Share photos & moments with your followers" />
        <TutorialRow icon={<Film className="h-5 w-5" />} title="Watch reels" body="Short videos tailored to your interests" />
        <TutorialRow icon={<MessageCircle className="h-5 w-5" />} title="Chat with friends" body="DMs with voice notes, reactions & calls" />
        <TutorialRow icon={<Compass className="h-5 w-5" />} title="Discover content" body="Search people, hashtags & places" />
        <TutorialRow icon={<Users className="h-5 w-5" />} title="Build community" body="Follow creators & join group chats" />
        <TutorialRow icon={<Bell className="h-5 w-5" />} title="Stay in the loop" body="Get notified about likes, comments & follows" />
      </div>
      <Button className="w-full h-11 mt-8 rounded-full" onClick={finish}>Enter Twiqo</Button>
    </div>,
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Progress */}
      {step > 0 && (
        <div className="flex gap-1 px-4 pt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      )}
      {steps[step]}
    </div>
  );
}

function TutorialRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground mt-3 shrink-0" />
    </div>
  );
}
