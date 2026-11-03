import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import { UserAvatar } from "@/components/Avatar";
import { AvatarCropper } from "@/components/onboarding/AvatarCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Camera, Check, Globe, Loader2, Lock, MapPin, Pencil, ShieldCheck, AtSign,
  Users, MessageCircle, RefreshCw,
} from "lucide-react";
import {
  INTERESTS, GENDER_OPTIONS, PRONOUN_OPTIONS, PRIVACY_CHOICES,
  USERNAME_MESSAGES, validateUsername, DRAFT_KEY, emptyDraft, parseDraft, serializeDraft,
  type OnboardingDraft, type PrivacyValue, type UsernameCheck,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (search: Record<string, unknown>) => {
    const n = Number(search.step ?? 0);
    return { step: Number.isFinite(n) && n >= 0 && n <= 7 ? Math.floor(n) : 0 };
  },
  staticData: { sitemap: false },
  head: () => pageSEO("Setup • Twiqo", "Set up your Twiqo profile.", "/onboarding"),
  component: Onboarding,
});

const TOTAL_STEPS = 8;

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();

  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); // avatar upload or final save
  const [uCheck, setUCheck] = useState<UsernameCheck>("empty");
  const [uTaken, setUTaken] = useState(false);
  const [uChecking, setUChecking] = useState(false);
  const [suggested, setSuggested] = useState<Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null; verified: boolean }>>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Load the draft once; resume at the saved step when arriving without one.
  useEffect(() => {
    const stored = parseDraft(localStorage.getItem(DRAFT_KEY));
    if (stored) {
      setDraft(stored);
      if (search.step === 0 && stored.step > 0) {
        navigate({ to: "/onboarding", search: { step: stored.step }, replace: true });
      }
    } else {
      const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
      const name = meta.full_name ?? meta.name ?? "";
      setDraft({ ...emptyDraft(), full_name: name, username: meta.username ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist progress so refreshes and logouts keep it.
  useEffect(() => {
    if (draft) localStorage.setItem(DRAFT_KEY, serializeDraft(draft));
  }, [draft]);

  // Suggested accounts to follow.
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("id, username, full_name, avatar_url, verified")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => setSuggested(data ?? []));
  }, [user?.id]);

  const go = useCallback((n: number) => {
    setDraft((d) => (d ? { ...d, step: n } : d));
    navigate({ to: "/onboarding", search: { step: n }, replace: true });
  }, [navigate]);

  // Live username availability.
  const username = draft?.username ?? "";
  useEffect(() => {
    if (!user) return;
    const v = validateUsername(username);
    setUTaken(false);
    if (v !== "ok") { setUCheck(v); setUChecking(false); return; }
    setUCheck("ok");
    setUChecking(true);
    const t = setTimeout(async () => {
      const pattern = username.replace(/_/g, "\\_");
      const { data } = await supabase.from("profiles").select("id, username").ilike("username", pattern).limit(1);
      const row = data?.[0];
      setUTaken(!!row && row.id !== user.id);
      setUChecking(false);
    }, 450);
    return () => clearTimeout(t);
  }, [username, user?.id]);

  if (!draft || !user) {
    return <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center twiqo-logo text-4xl">Twiqo</div>;
  }

  const set = (patch: Partial<OnboardingDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (f.size > 15 * 1024 * 1024) { toast.error("Photo is too large (max 15MB)."); return; }
    setPendingFile(f);
  };

  const onCropped = async (f: File) => {
    setPendingFile(null);
    setBusy(true);
    try {
      const path = await uploadMedia(user.id, f);
      const preview = (f as File & { previewDataUrl?: string }).previewDataUrl ?? null;
      set({ avatarPath: path, avatarPreview: preview });
      toast.success("Profile picture set");
    } catch {
      toast.error("Upload failed — check your connection and try again.");
    }
    setBusy(false);
  };

  const toggleFollow = async (uid: string) => {
    const following = draft.followedIds.includes(uid);
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", uid);
      set({ followedIds: draft.followedIds.filter((x) => x !== uid) });
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: uid });
      set({ followedIds: [...draft.followedIds, uid] });
    }
  };

  const infoValid = draft.full_name.trim().length > 0 && uCheck === "ok" && !uTaken && !uChecking;

  const finish = async () => {
    if (validateUsername(draft.username) !== "ok" || uTaken) { go(2); toast.error("Please fix your username first."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: draft.full_name.trim(),
      username: draft.username.trim(),
      bio: draft.bio.trim() || null,
      location: draft.location.trim() || null,
      website: draft.website.trim() || null,
      avatar_url: draft.avatarPath,
      date_of_birth: draft.dob || null,
      gender: draft.gender && draft.gender !== "Prefer not to say" ? draft.gender : null,
      pronouns: draft.pronouns && draft.pronouns !== "Prefer not to say" ? draft.pronouns : null,
      interests: draft.interests,
      is_private: draft.is_private,
      reply_visibility: draft.reply_visibility,
      mention_permission: draft.mention_permission,
      message_permission: draft.message_permission,
      onboarded: true,
    }).eq("id", user.id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    // Friendly welcome notification (recipient-insert policy; non-fatal).
    await supabase.from("notifications").insert({ recipient_id: user.id, actor_id: user.id, type: "welcome" }).then(() => {}, () => {});
    localStorage.removeItem(DRAFT_KEY);
    await qc.invalidateQueries();
    toast.success("Welcome to Twiqo! 🎉");
    setBusy(false);
    navigate({ to: "/home", replace: true });
  };

  const firstName = (draft.full_name.trim() || (user.user_metadata?.full_name as string | undefined) || "").split(" ")[0];

  const steps = [
    // 0 — Welcome
    <div key="welcome" className="flex flex-col items-center text-center px-6 py-10 gap-4">
      <img src="/icons/icon-512.png" alt="Twiqo" width={96} height={96} className="h-24 w-24 rounded-[24%] shadow-lg shadow-primary/20" />
      <h1 className="twiqo-logo text-4xl mt-1">Twiqo</h1>
      <h2 className="text-2xl font-bold">{firstName ? `Welcome, ${firstName}!` : "Welcome!"}</h2>
      <p className="text-muted-foreground">Let&apos;s set up your profile.</p>
      <p className="text-sm text-muted-foreground">It takes less than a minute — you can change anything later.</p>
      <Button className="w-full max-w-xs h-11 mt-4 rounded-full" onClick={() => go(1)}>Continue</Button>
    </div>,

    // 1 — Profile picture
    <div key="photo" className="px-6 py-6">
      <h2 className="text-2xl font-bold text-center">Add a profile picture</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">Help people recognize you.</p>
      <div className="flex flex-col items-center mt-8 gap-6">
        {pendingFile ? (
          <AvatarCropper file={pendingFile} onCancel={() => setPendingFile(null)} onCropped={onCropped} />
        ) : (
          <>
            <div className="relative">
              {busy ? (
                <div className="h-28 w-28 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : draft.avatarPreview ? (
                <img src={draft.avatarPreview} alt="Your profile picture" className="h-28 w-28 rounded-full object-cover" />
              ) : (
                <UserAvatar path={null} username={draft.username || user.email || "U"} size={112} />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button variant="secondary" className="h-11 rounded-full" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" /> Choose from device
              </Button>
              <Button variant="secondary" className="h-11 rounded-full" disabled={busy} onClick={() => cameraRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" /> Take a photo
              </Button>
              {draft.avatarPath && (
                <Button variant="ghost" className="h-10 rounded-full text-destructive" disabled={busy}
                  onClick={() => set({ avatarPath: null, avatarPreview: null })}>
                  Remove photo
                </Button>
              )}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={onPickFile} className="hidden" />
      </div>
      <Button className="w-full h-11 mt-6 rounded-full" disabled={busy || !!pendingFile} onClick={() => go(2)}>Next</Button>
      <button onClick={() => go(2)} disabled={busy} className="w-full text-center text-sm text-muted-foreground py-3">
        {draft.avatarPath ? "Next" : "Skip for now — use a default avatar"}
      </button>
    </div>,

    // 2 — Basic info
    <div key="info" className="px-6 py-6">
      <h2 className="text-2xl font-bold text-center">Your details</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">This is how people see you on Twiqo.</p>
      <div className="mt-6 space-y-4 max-w-md mx-auto">
        <div>
          <label htmlFor="ob-name" className="text-sm font-medium">Display name</label>
          <Input id="ob-name" className="mt-1" placeholder="e.g. Josh Lee" maxLength={40}
            value={draft.full_name} onChange={(e) => set({ full_name: e.target.value })} />
          {draft.full_name.trim().length === 0 && <p className="text-xs text-destructive mt-1">Display name is required.</p>}
        </div>
        <div>
          <label htmlFor="ob-username" className="text-sm font-medium">Username</label>
          <div className="relative mt-1">
            <AtSign className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input id="ob-username" className="pl-9 pr-9" placeholder="josh_lee" maxLength={20} autoComplete="off"
              value={draft.username} onChange={(e) => set({ username: e.target.value })} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {uChecking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : uCheck === "ok" && !uTaken ? <Check className="h-4 w-4 text-[var(--color-verified)]" /> : null}
            </span>
          </div>
          <p className={`text-xs mt-1 ${uTaken || uCheck !== "ok" && uCheck !== "empty" ? "text-destructive" : "text-muted-foreground"}`}>
            {uCheck === "ok" && !uChecking && !uTaken && username.trim().length > 0
              ? "Great — that username is available."
              : uTaken
                ? "That username is already taken."
                : uCheck !== "ok" && uCheck !== "empty" && !uChecking
                  ? USERNAME_MESSAGES[uCheck]
                  : "Letters, numbers and underscores only."}
          </p>
        </div>
        <div>
          <label htmlFor="ob-bio" className="text-sm font-medium">Bio</label>
          <Textarea id="ob-bio" className="mt-1" rows={2} maxLength={160} placeholder="A short description about yourself"
            value={draft.bio} onChange={(e) => set({ bio: e.target.value })} />
          <p className="text-xs text-muted-foreground mt-1">{draft.bio.length}/160</p>
        </div>
        <div>
          <label htmlFor="ob-location" className="text-sm font-medium">Location <span className="text-muted-foreground font-normal">(optional)</span></label>
          <div className="relative mt-1">
            <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input id="ob-location" className="pl-9" placeholder="City or country" maxLength={60}
              value={draft.location} onChange={(e) => set({ location: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="ob-website" className="text-sm font-medium">Website <span className="text-muted-foreground font-normal">(optional)</span></label>
          <div className="relative mt-1">
            <Globe className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input id="ob-website" className="pl-9" placeholder="https://example.com" maxLength={100} type="url"
              value={draft.website} onChange={(e) => set({ website: e.target.value })} />
          </div>
        </div>
      </div>
      <Button className="w-full max-w-md h-11 mt-6 rounded-full mx-auto block" disabled={!infoValid} onClick={() => go(3)}>Next</Button>
    </div>,

    // 3 — Personal details
    <div key="personal" className="px-6 py-6">
      <h2 className="text-2xl font-bold text-center">Personal details</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">All optional. Your date of birth is always kept private and never shown on your profile.</p>
      <div className="mt-6 space-y-4 max-w-md mx-auto">
        <div>
          <label htmlFor="ob-dob" className="text-sm font-medium">Date of birth <span className="text-muted-foreground font-normal">(private)</span></label>
          <Input id="ob-dob" className="mt-1" type="date" max={new Date().toISOString().slice(0, 10)}
            value={draft.dob} onChange={(e) => set({ dob: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ob-gender" className="text-sm font-medium">Gender <span className="text-muted-foreground font-normal">(optional)</span></label>
          <select id="ob-gender" className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">Select…</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ob-pronouns" className="text-sm font-medium">Pronouns <span className="text-muted-foreground font-normal">(optional)</span></label>
          <select id="ob-pronouns" className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.pronouns} onChange={(e) => set({ pronouns: e.target.value })}>
            <option value="">Select…</option>
            {PRONOUN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Your date of birth and gender are stored privately — they are never displayed on your public profile.</p>
        </div>
      </div>
      <Button className="w-full max-w-md h-11 mt-6 rounded-full mx-auto block" onClick={() => go(4)}>Next</Button>
    </div>,

    // 4 — Interests & following
    <div key="interests" className="px-4 py-6">
      <h2 className="text-2xl font-bold text-center px-2">What are you into?</h2>
      <p className="text-sm text-muted-foreground text-center mt-1 px-4">Pick a few interests so we can personalize your recommendations.</p>
      <div className="flex flex-wrap gap-2 mt-5 justify-center px-2">
        {INTERESTS.map((t) => {
          const active = draft.interests.includes(t);
          return (
            <button key={t} onClick={() => set({ interests: active ? draft.interests.filter((x) => x !== t) : [...draft.interests, t] })}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
              {active && <Check className="h-3 w-3 inline mr-1" />}{t}
            </button>
          );
        })}
      </div>

      <h3 className="text-lg font-semibold text-center mt-8">Suggested for you</h3>
      <p className="text-sm text-muted-foreground text-center mt-1">Follow accounts to fill your feed — or skip.</p>
      <ul className="mt-4 max-w-md mx-auto space-y-1">
        {suggested.map((u) => {
          const following = draft.followedIds.includes(u.id);
          return (
            <li key={u.id} className="flex items-center gap-3 p-2 rounded-lg">
              <UserAvatar path={u.avatar_url} username={u.username} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.username}</div>
                <div className="text-xs text-muted-foreground truncate">{u.full_name ?? "On Twiqo"}</div>
              </div>
              <Button size="sm" variant={following ? "secondary" : "default"} className="rounded-full h-8 shrink-0" onClick={() => toggleFollow(u.id)}>
                {following ? "Following" : "Follow"}
              </Button>
            </li>
          );
        })}
        {!suggested.length && <li className="text-center text-sm text-muted-foreground py-4">No suggestions right now.</li>}
      </ul>
      <div className="max-w-md mx-auto">
        <Button className="w-full h-11 mt-5 rounded-full" onClick={() => go(5)}>
          Continue {draft.interests.length > 0 && `· ${draft.interests.length} interest${draft.interests.length > 1 ? "s" : ""}`}
        </Button>
        <button onClick={() => go(5)} className="w-full text-center text-sm text-muted-foreground py-3">Skip</button>
      </div>
    </div>,

    // 5 — Privacy
    <div key="privacy" className="px-6 py-6">
      <h2 className="text-2xl font-bold text-center">Choose your privacy</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">You can change any of these later in Settings.</p>
      <div className="mt-6 space-y-5 max-w-md mx-auto">
        <PrivacyToggle
          icon={draft.is_private ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          title={draft.is_private ? "Private account" : "Public account"}
          description={draft.is_private
            ? "Only people you approve can follow you and see your posts."
            : "Anyone can follow you and see your posts."}
          options={[{ label: "Public", value: false }, { label: "Private", value: true }]}
          value={draft.is_private}
          onChange={(v) => set({ is_private: v })}
        />
        <PrivacyToggle
          icon={<MessageCircle className="h-4 w-4" />}
          title="Who can reply to your posts"
          options={PRIVACY_CHOICES}
          value={draft.reply_visibility}
          onChange={(v) => set({ reply_visibility: v })}
        />
        <PrivacyToggle
          icon={<AtSign className="h-4 w-4" />}
          title="Who can mention or tag you"
          options={PRIVACY_CHOICES}
          value={draft.mention_permission}
          onChange={(v) => set({ mention_permission: v })}
        />
        <PrivacyToggle
          icon={<Users className="h-4 w-4" />}
          title="Who can send you messages"
          options={PRIVACY_CHOICES}
          value={draft.message_permission}
          onChange={(v) => set({ message_permission: v })}
        />
      </div>
      <Button className="w-full max-w-md h-11 mt-6 rounded-full mx-auto block" onClick={() => go(6)}>Next</Button>
    </div>,

    // 6 — Preview
    <div key="preview" className="px-6 py-6">
      <h2 className="text-2xl font-bold text-center">Here&apos;s your profile</h2>
      <p className="text-sm text-muted-foreground text-center mt-1">This is how others will see you. Tap Edit to change anything.</p>
      <div className="mt-6 max-w-md mx-auto rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          {draft.avatarPreview
            ? <img src={draft.avatarPreview} alt="Profile preview" className="h-20 w-20 rounded-full object-cover" />
            : <UserAvatar path={null} username={draft.username || user.email || "U"} size={80} />}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => go(1)}><Pencil className="h-3 w-3 mr-1" /> Photo</Button>
            <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => go(2)}><Pencil className="h-3 w-3 mr-1" /> Details</Button>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-lg font-bold">{draft.full_name || "Your name"}</div>
          <div className="text-sm text-muted-foreground">@{draft.username || "username"}</div>
          {draft.bio && <p className="text-sm mt-2">{draft.bio}</p>}
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
            {draft.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{draft.location}</span>}
            {draft.website && <a href={draft.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe className="h-3.5 w-3.5" />{draft.website.replace(/^https?:\/\//, "")}</a>}
          </div>
          {draft.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {draft.interests.map((i) => <span key={i} className="px-2.5 py-1 rounded-full bg-secondary text-xs">{i}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        {draft.is_private ? "Private account" : "Public account"} · {PRIVACY_CHOICES.find((c) => c.value === draft.message_permission)?.label} can message you
      </div>
      <Button className="w-full max-w-md h-11 mt-6 rounded-full mx-auto block" onClick={() => go(7)}>Looks good</Button>
    </div>,

    // 7 — Complete
    <div key="complete" className="flex flex-col items-center text-center px-6 py-12 gap-4">
      <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
      <p className="text-muted-foreground max-w-xs">
        Tap below to save your profile and jump into your feed. Your interests and follows are already working.
      </p>
      <Button className="w-full max-w-xs h-11 mt-4 rounded-full text-base" disabled={busy} onClick={finish}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Complete Setup
      </Button>
      <button onClick={() => go(6)} disabled={busy} className="text-sm text-muted-foreground py-2">Back to preview</button>
    </div>,
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background animate-in fade-in duration-300" key={search.step}>
      {search.step < 7 && (
        <div className="flex gap-1 px-4 pt-3" aria-label={`Step ${search.step + 1} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= search.step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      )}
      {steps[search.step] ?? steps[0]}
    </div>
  );
}

function PrivacyToggle({ icon, title, description, options, value, onChange }: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  options: ReadonlyArray<{ label: string; value: string | number | boolean; hint?: string }>;
  value: string | number | boolean;
  onChange: (v: never) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{description}</p>}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={String(o.value)} onClick={() => onChange(o.value as never)}
              className={`px-2 py-2.5 rounded-xl border text-xs font-medium transition text-center ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}>
              {o.label}
              {o.hint && <span className="block text-[10px] font-normal mt-0.5 opacity-80">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
