import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, LogOut, Moon, KeyRound, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings • VibeLink" }] }),
  component: Settings,
});

function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  const toggleDark = (v: boolean) => {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("theme", v ? "dark" : "light");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const row = (icon: React.ReactNode, label: string, right: React.ReactNode, onClick?: () => void) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/40 border-b border-border text-left">
      <span className="text-foreground/80">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {right}
    </button>
  );

  return (
    <div>
      <h1 className="text-lg font-semibold px-4 py-3 border-b border-border">Settings</h1>
      <div className="px-4 py-3 text-sm text-muted-foreground border-b border-border">
        Signed in as <span className="font-medium text-foreground">{user?.email}</span>
      </div>

      <div className="mt-2">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-muted-foreground">Account</div>
        <Link to="/edit-profile">{row(<UserCog className="h-5 w-5" />, "Edit profile", <ChevronRight className="h-5 w-5 text-muted-foreground" />)}</Link>
        <Link to="/reset-password">{row(<KeyRound className="h-5 w-5" />, "Reset password", <ChevronRight className="h-5 w-5 text-muted-foreground" />)}</Link>
      </div>

      <div className="mt-2">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase text-muted-foreground">Appearance</div>
        {row(<Moon className="h-5 w-5" />, "Dark mode", <Switch checked={dark} onCheckedChange={toggleDark} />)}
      </div>

      <div className="px-4 mt-6">
        <Button variant="destructive" onClick={handleSignOut} className="w-full h-11">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}
