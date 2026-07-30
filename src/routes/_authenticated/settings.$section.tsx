import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Moon, Sun, SunMoon } from "lucide-react";
import { getThemeMode, resolveTheme, setThemeMode, type ThemeMode } from "@/lib/theme";
import { toast } from "sonner";
import { setPresenceSharing } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/settings/$section")({
  head: ({ params }) => ({ meta: [{ title: `${prettify(params.section)} • VibeLink` }] }),
  component: SectionPage,
});

function prettify(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

interface Setting {
  is_private: boolean;
  show_activity_status: boolean;
  allow_message_requests: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
  language: string;
  theme: string;
}

const DEFAULTS: Setting = {
  is_private: false, show_activity_status: true, allow_message_requests: true,
  push_notifications: true, email_notifications: true, language: "en", theme: "light",
};

function useSettings() {
  const { user } = useAuth();
  const [s, setS] = useState<Setting>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setS({ ...DEFAULTS, ...data });
      setLoaded(true);
    });
  }, [user]);
  const update = async (patch: Partial<Setting>) => {
    if (!user) return;
    setS((cur) => ({ ...cur, ...patch }));
    const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, ...s, ...patch });
    if (error) toast.error(error.message);
  };
  return { s, update, loaded };
}

function SectionPage() {
  const { section } = useParams({ from: "/_authenticated/settings/$section" });
  const title = prettify(section);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Link to="/settings" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="font-semibold text-base">{title}</h1>
      </div>
      <SectionBody section={section} />
    </div>
  );
}

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border/60">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className="px-4 py-6 text-sm text-muted-foreground">{text}</p>;
}

function SectionBody({ section }: { section: string }) {
  const { s, update, loaded } = useSettings();
  const { user } = useAuth();

  if (!loaded && ["privacy", "notifications", "messages"].includes(section)) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  switch (section) {
    case "account-center":
      return (
        <div>
          <div className="px-4 py-6 text-center border-b border-border">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 mb-3" />
            <h2 className="font-semibold">Accounts Center</h2>
            <p className="text-xs text-muted-foreground mt-1">Manage connected experiences across Meta technologies.</p>
          </div>
          <Row label="Personal details" right={<span className="text-xs text-muted-foreground">View</span>} />
          <Row label="Password and security" right={<span className="text-xs text-muted-foreground">Manage</span>} />
          <Row label="Ad preferences" right={<span className="text-xs text-muted-foreground">Edit</span>} />
          <Row label="Connected experiences" right={<span className="text-xs text-muted-foreground">Setup</span>} />
        </div>
      );

    case "privacy":
      return (
        <>
          <Row label="Private account"
            hint="When private, only people who follow you can see your posts."
            right={<Switch checked={s.is_private} onCheckedChange={(v) => update({ is_private: v })} />} />
          <Row label="Show activity status"
            hint="Allow accounts you follow and people you message to see when you were last active."
            right={<Switch checked={s.show_activity_status} onCheckedChange={async (v) => {
              update({ show_activity_status: v });
              if (user) await supabase.from("profiles").update({ show_activity_status: v }).eq("id", user.id);
              await setPresenceSharing(v);
            }} />} />
        </>
      );

    case "notifications":
      return (
        <>
          <Row label="Push notifications" right={<Switch checked={s.push_notifications} onCheckedChange={(v) => update({ push_notifications: v })} />} />
          <Row label="Email notifications" right={<Switch checked={s.email_notifications} onCheckedChange={(v) => update({ email_notifications: v })} />} />
          <Row label="Likes" hint="From people you follow" right={<Switch defaultChecked />} />
          <Row label="Comments" right={<Switch defaultChecked />} />
          <Row label="New followers" right={<Switch defaultChecked />} />
          <Row label="Direct messages" right={<Switch defaultChecked />} />
          <Row label="Live videos" right={<Switch />} />
          <Row label="Reels and creator updates" right={<Switch defaultChecked />} />
        </>
      );

    case "messages":
      return (
        <>
          <Row label="Allow message requests"
            hint="People who don't follow you can send you messages that go to requests."
            right={<Switch checked={s.allow_message_requests} onCheckedChange={(v) => update({ allow_message_requests: v })} />} />
          <Row label="Story replies" hint="People you follow" right={<span className="text-xs text-muted-foreground">Everyone</span>} />
          <Row label="Story reactions" right={<Switch defaultChecked />} />
        </>
      );

    case "appearance":
      return <AppearanceSection />;

    case "accessibility":
      return (
        <>
          <Row label="Dark mode" right={<DarkModeSwitch />} />
          <Row label="Reduce motion" right={<Switch />} />
          <Row label="High contrast" right={<Switch />} />
          <Row label="Captions" right={<Switch defaultChecked />} />
          <Row label="Alt text auto-generation" right={<Switch defaultChecked />} />
        </>
      );

    case "language":
      return (
        <>
          <Row label="App language" right={<span className="text-xs text-muted-foreground">English</span>} />
          <Row label="Translations" right={<Switch defaultChecked />} />
          <Placeholder text="Multi-language support coming soon." />
        </>
      );

    case "blocked":
      return <Placeholder text="You haven't blocked anyone." />;
    case "close-friends":
      return <Placeholder text="Add people to your Close friends list to share with a smaller audience." />;
    case "hide-story":
      return <Placeholder text="Choose people to hide your story and live from." />;
    case "restricted":
      return <Placeholder text="Restrict accounts to limit their interactions without notifying them." />;
    case "muted":
      return <Placeholder text="Accounts you've muted will appear here." />;
    case "hidden-words":
      return (
        <>
          <Row label="Hide comments" right={<Switch defaultChecked />} />
          <Row label="Hide message requests" right={<Switch defaultChecked />} />
          <Row label="Custom words and phrases" right={<span className="text-xs text-muted-foreground">Manage</span>} />
        </>
      );
    case "comments":
      return (
        <>
          <Row label="Allow comments from" right={<span className="text-xs text-muted-foreground">Everyone</span>} />
          <Row label="Manual filter" right={<Switch />} />
        </>
      );
    case "tags":
      return (
        <>
          <Row label="Allow tags from" right={<span className="text-xs text-muted-foreground">Everyone</span>} />
          <Row label="Manually approve tags" right={<Switch />} />
        </>
      );
    case "sharing":
      return (
        <>
          <Row label="Allow sharing to stories" right={<Switch defaultChecked />} />
          <Row label="Allow remixing of reels" right={<Switch defaultChecked />} />
        </>
      );
    case "suggested":
      return (
        <>
          <Row label="Suggested accounts" right={<Switch defaultChecked />} />
          <Row label="Suggested posts in feed" right={<Switch defaultChecked />} />
        </>
      );
    case "like-counts":
      return (
        <>
          <Row label="Hide like and view counts" hint="For all posts" right={<Switch />} />
        </>
      );
    case "subscriptions":
      return <Placeholder text="Your subscriptions will appear here." />;
    case "time-management":
      return (
        <>
          <Row label="Daily time limit" right={<span className="text-xs text-muted-foreground">Off</span>} />
          <Row label="Quiet mode" right={<Switch />} />
          <Row label="Notification scheduling" right={<span className="text-xs text-muted-foreground">Set</span>} />
        </>
      );
    case "archiving":
      return (
        <>
          <Row label="Save original photos" right={<Switch defaultChecked />} />
          <Row label="Save posted photos" right={<Switch />} />
          <Row label="Download your data" right={<span className="text-xs text-muted-foreground">Request</span>} />
        </>
      );
    case "data-usage":
      return (
        <>
          <Row label="Use less data" right={<Switch />} />
          <Row label="Upload at highest quality" right={<Switch defaultChecked />} />
        </>
      );
    case "website-permissions":
      return <Placeholder text="Connected websites and apps will appear here." />;
    case "creator":
      return <Placeholder text="Tools for creators — insights, branded content, monetization." />;
    case "business":
      return <Placeholder text="Tools for businesses — contact options, page categories, ads." />;
    case "branded":
      return <Placeholder text="Approve and manage branded content collaborations." />;
    case "orders":
      return <Placeholder text="Your orders and payment methods will appear here." />;
    case "help":
      return (
        <>
          <Row label="Help Center" right={<span className="text-xs text-muted-foreground">Open</span>} />
          <Row label="Privacy and Safety Center" right={<span className="text-xs text-muted-foreground">Open</span>} />
          <Row label="Report a problem" right={<span className="text-xs text-muted-foreground">Open</span>} />
        </>
      );
    case "privacy-policy":
      return <Placeholder text="Learn more about how we keep your data safe." />;
    case "legal":
      return <Placeholder text="Your account is in good standing." />;
    case "about":
      return (
        <>
          <Row label="App version" right={<span className="text-xs text-muted-foreground">1.0.0</span>} />
          <Row label="Terms of Service" right={<span className="text-xs text-muted-foreground">Open</span>} />
          <Row label="Privacy Policy" right={<span className="text-xs text-muted-foreground">Open</span>} />
        </>
      );
    case "security":
      return (
        <>
          <Row label="Two-factor authentication" hint="Require a security code at login." right={<Switch />} />
          <Row label="Login activity" right={<span className="text-xs text-muted-foreground">View</span>} />
          <Row label="Emails from VibeLink" right={<span className="text-xs text-muted-foreground">View</span>} />
          <div className="px-4 mt-4">
            <Link to="/reset-password"><Button variant="secondary" className="w-full">Change password</Button></Link>
          </div>
        </>
      );
    case "saved":
      return <Placeholder text="Posts you save will appear here." />;
    case "archive":
      return <Placeholder text="Archived posts and stories will appear here." />;
    case "activity":
      return <Placeholder text="Your likes, comments, and recent activity." />;

    default:
      return <Placeholder text={`This section is coming soon.`} />;
  }
}

function DarkModeSwitch() {
  const [dark, setDark] = useState<boolean>(() => resolveTheme(getThemeMode()) === "dark");
  const toggle = (v: boolean) => {
    setDark(v);
    setThemeMode(v ? "dark" : "light");
  };
  return <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-muted-foreground" /><Switch checked={dark} onCheckedChange={toggle} /></span>;
}

const APPEARANCE_OPTIONS: { key: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", hint: "White background, dark text", icon: Sun },
  { key: "dark", label: "Dark", hint: "Dark background, white text", icon: Moon },
  { key: "system", label: "System default", hint: "Follows your device setting automatically", icon: SunMoon },
];

function AppearanceSection() {
  const [mode, setMode] = useState<ThemeMode>(() => getThemeMode());
  const pick = (m: ThemeMode) => { setMode(m); setThemeMode(m); };
  return (
    <div className="py-2">
      {APPEARANCE_OPTIONS.map((o) => (
        <button key={o.key} onClick={() => pick(o.key)}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 text-left">
          <o.icon className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </span>
          <span className={`h-4 w-4 rounded-full border-2 ${mode === o.key ? "border-primary bg-primary" : "border-border"}`} />
        </button>
      ))}
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        VibeLink's accent color stays the same in every theme.
      </p>
    </div>
  );
}
