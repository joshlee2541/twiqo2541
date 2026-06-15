import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { ChevronRight, Search, LogOut } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings • VibeLink" }] }),
  component: SettingsHub,
});

const GROUPS: { title: string; items: { to: string; label: string }[] }[] = [
  { title: "Your account", items: [
    { to: "/settings/account-center", label: "Account Center" },
    { to: "/edit-profile", label: "Edit profile" },
    { to: "/settings/saved", label: "Saved" },
    { to: "/settings/archive", label: "Archive" },
    { to: "/settings/activity", label: "Your activity" },
  ]},
  { title: "How you use VibeLink", items: [
    { to: "/settings/notifications", label: "Notifications" },
    { to: "/settings/time-management", label: "Time management" },
  ]},
  { title: "Who can see your content", items: [
    { to: "/settings/privacy", label: "Account privacy" },
    { to: "/settings/close-friends", label: "Close friends" },
    { to: "/settings/blocked", label: "Blocked" },
    { to: "/settings/hide-story", label: "Hide story and live" },
  ]},
  { title: "How others can interact with you", items: [
    { to: "/settings/messages", label: "Messages and story replies" },
    { to: "/settings/tags", label: "Tags and mentions" },
    { to: "/settings/comments", label: "Comments" },
    { to: "/settings/sharing", label: "Sharing and reuse" },
    { to: "/settings/restricted", label: "Restricted" },
    { to: "/settings/hidden-words", label: "Hidden words" },
  ]},
  { title: "What you see", items: [
    { to: "/settings/muted", label: "Muted accounts" },
    { to: "/settings/suggested", label: "Suggested content" },
    { to: "/settings/like-counts", label: "Like and share counts" },
    { to: "/settings/subscriptions", label: "Subscriptions" },
  ]},
  { title: "Your app and media", items: [
    { to: "/settings/archiving", label: "Archiving and downloading" },
    { to: "/settings/accessibility", label: "Accessibility and translations" },
    { to: "/settings/language", label: "Language" },
    { to: "/settings/data-usage", label: "Data usage and media quality" },
    { to: "/settings/website-permissions", label: "Website permissions" },
  ]},
  { title: "For professionals", items: [
    { to: "/settings/creator", label: "Creator tools and controls" },
    { to: "/settings/business", label: "Business tools and controls" },
    { to: "/settings/branded", label: "Branded content" },
    { to: "/settings/orders", label: "Orders and payments" },
  ]},
  { title: "More info and support", items: [
    { to: "/settings/help", label: "Help" },
    { to: "/settings/privacy-policy", label: "Privacy Center" },
    { to: "/settings/legal", label: "Account status" },
    { to: "/settings/about", label: "About" },
  ]},
  { title: "Login", items: [
    { to: "/settings/security", label: "Password and security" },
    { to: "/reset-password", label: "Reset password" },
  ]},
];

function SettingsHub() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const handleSignOut = async () => { await signOut(); navigate({ to: "/auth" }); };
  const lower = q.trim().toLowerCase();

  return (
    <div className="pb-10">
      <h1 className="text-xl font-bold px-4 py-3">Settings and activity</h1>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-muted border-0" />
        </div>
      </div>
      <div className="px-4 py-3 text-sm text-muted-foreground border-y border-border">
        Signed in as <span className="font-medium text-foreground">{user?.email}</span>
      </div>

      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !lower || i.label.toLowerCase().includes(lower) || g.title.toLowerCase().includes(lower));
        if (!items.length) return null;
        return (
          <div key={g.title} className="mt-4">
            <div className="px-4 pb-1 text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">{g.title}</div>
            {items.map((i) => (
              <Link key={i.to} to={i.to} className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 border-b border-border/60">
                <span className="text-sm">{i.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        );
      })}

      <div className="px-4 mt-6">
        <button onClick={handleSignOut} className="w-full text-sm font-semibold text-destructive py-3 border-t border-border">
          <LogOut className="h-4 w-4 inline mr-2" />Log out
        </button>
      </div>
    </div>
  );
}
