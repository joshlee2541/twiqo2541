import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Clapperboard, User as UserIcon, Send, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

function CreateIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  const navItem = (to: string, active: boolean, icon: ReactNode) => (
    <Link
      to={to}
      className="flex-1 flex items-center justify-center min-h-12 transition-colors"
      aria-current={active ? "page" : undefined}
    >
      <span className="text-foreground">{icon}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/home" className="twiqo-logo text-2xl text-foreground leading-none">
            Twiqo
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/notifications" className="p-2" aria-label="Notifications">
              <Heart className="h-6 w-6" strokeWidth={1.5} fill={pathname.startsWith("/notifications") ? "currentColor" : "none"} />
            </Link>
            <Link to="/messages" className="p-2" aria-label="Messages">
              <Send className="h-6 w-6 -rotate-12" strokeWidth={1.5} fill={pathname.startsWith("/messages") ? "currentColor" : "none"} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto pb-24">
        {children}
        <div className="text-center text-[11px] text-muted-foreground py-4 space-y-0.5">
          <div>from <span className="font-semibold text-foreground">Lee Tech</span></div>
          <div>© {new Date().getFullYear()} Twiqo. All rights reserved.</div>
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-2xl mx-auto flex items-center">
          {navItem("/home", pathname === "/home", <Home className="h-6 w-6" strokeWidth={1.5} fill={pathname === "/home" ? "currentColor" : "none"} />)}
          {navItem("/explore", pathname.startsWith("/explore"), <Search className="h-6 w-6" strokeWidth={1.5} fill={pathname.startsWith("/explore") ? "currentColor" : "none"} />)}
          {navItem("/create", pathname === "/create", <CreateIcon active={pathname === "/create"} />)}
          {navItem("/reels", pathname.startsWith("/reels"), <Clapperboard className="h-6 w-6" strokeWidth={1.5} fill={pathname.startsWith("/reels") ? "currentColor" : "none"} />)}
          <Link
            to="/profile/$username"
            params={{ username: username ?? "me" }}
            className="flex-1 flex items-center justify-center min-h-12"
          >
            <span
              className={
                "flex h-7 w-7 items-center justify-center rounded-full border transition-colors " +
                (pathname.startsWith("/profile") ? "border-foreground" : "border-transparent")
              }
            >
              <UserIcon className="h-6 w-6" strokeWidth={1.5} fill={pathname.startsWith("/profile") ? "currentColor" : "none"} />
            </span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

