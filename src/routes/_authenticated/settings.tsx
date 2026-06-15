import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { ChevronRight, Search, LogOut } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings • VibeLink" }] }),
  component: SettingsHub,
});

interface Item { section?: string; to?: "/edit-profile" | "/reset-password"; label: string }
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Your account", items: [
    { section: "account-center", label: "Account Center" },
    { to: "/edit-profile", label: "Edit profile" },
    { section: "saved", label: "Saved" },
    { section: "archive", label: "Archive" },
    { section: "activity", label: "Your activity" },
  ]},
  { title: "How you use VibeLink", items: [
    { section: "notifications", label: "Notifications" },
    { section: "time-management", label: "Time management" },
  ]},
  { title: "Who can see your content", items: [
    { section: "privacy", label: "Account privacy" },
    { section: "close-friends", label: "Close friends" },
    { section: "blocked", label: "Blocked" },
    { section: "hide-story", label: "Hide story and live" },
  ]},
  { title: "How others can interact with you", items: [
    { section: "messages", label: "Messages and story replies" },
    { section: "tags", label: "Tags and mentions" },
    { section: "comments", label: "Comments" },
    { section: "sharing", label: "Sharing and reuse" },
    { section: "restricted", label: "Restricted" },
    { section: "hidden-words", label: "Hidden words" },
  ]},
  { title: "What you see", items: [
    { section: "muted", label: "Muted accounts" },
    { section: "suggested", label: "Suggested content" },
    { section: "like-counts", label: "Like and share counts" },
    { section: "subscriptions", label: "Subscriptions" },
  ]},
  { title: "Your app and media", items: [
    { section: "archiving", label: "Archiving and downloading" },
    { section: "accessibility", label: "Accessibility and translations" },
    { section: "language", label: "Language" },
    { section: "data-usage", label: "Data usage and media quality" },
    { section: "website-permissions", label: "Website permissions" },
  ]},
  { title: "For professionals", items: [
    { section: "creator", label: "Creator tools and controls" },
    { section: "business", label: "Business tools and controls" },
    { section: "branded", label: "Branded content" },
    { section: "orders", label: "Orders and payments" },
  ]},
  { title: "More info and support", items: [
    { section: "help", label: "Help" },
    { section: "privacy-policy", label: "Privacy Center" },
    { section: "legal", label: "Account status" },
    { section: "about", label: "About" },
  ]},
  { title: "Login", items: [
    { section: "security", label: "Password and security" },
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
              i.section ? (
                <Link key={i.section} to="/settings/$section" params={{ section: i.section }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 border-b border-border/60">
                  <span className="text-sm">{i.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : (
                <Link key={i.to} to={i.to!}
                  className="flex items-center justify-between px-4 py-3 hover:bg-accent/40 border-b border-border/60">
                  <span className="text-sm">{i.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )
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
