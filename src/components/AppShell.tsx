import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, PlusSquare, Film, User as UserIcon, Send, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/vibelink-logo.png.asset.json";

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
    <Link to={to} className="flex-1 flex items-center justify-center py-3" aria-current={active ? "page" : undefined}>
      <span className={active ? "text-foreground" : "text-foreground/70"}>{icon}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="VibeLink" className="h-8 w-8 rounded-lg" />
            <span className="vibelink-logo text-2xl">VibeLink</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/notifications" className="p-2" aria-label="Notifications">
              <Heart className="h-6 w-6" />
            </Link>
            <Link to="/messages" className="p-2" aria-label="Messages">
              <Send className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto pb-24">
        {children}
        <div className="text-center text-[11px] text-muted-foreground py-4 space-y-0.5">
          <div>from <span className="font-semibold text-foreground">Lee Tech</span></div>
          <div>© {new Date().getFullYear()} VibeLink. All rights reserved.</div>
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-2xl mx-auto flex">
          {navItem("/home", pathname === "/home", <Home className="h-6 w-6" />)}
          {navItem("/explore", pathname.startsWith("/explore"), <Search className="h-6 w-6" />)}
          {navItem("/create", pathname === "/create", <PlusSquare className="h-7 w-7" />)}
          {navItem("/reels", pathname.startsWith("/reels"), <Film className="h-6 w-6" />)}
          <Link
            to="/profile/$username"
            params={{ username: username ?? "me" }}
            className="flex-1 flex items-center justify-center py-3"
          >
            <UserIcon className={pathname.startsWith("/profile") ? "h-6 w-6 text-foreground" : "h-6 w-6 text-foreground/70"} />
          </Link>
        </div>
      </nav>
    </div>
  );
}
