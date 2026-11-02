import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staticData: { sitemap: "exclude-subtree" },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }] }),
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setOnboarded(null); return; }
    supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle()
      .then(({ data }) => setOnboarded(data?.onboarded ?? false));
  }, [user?.id]);

  if (loading || (user && onboarded === null)) {
    return <div className="min-h-screen flex items-center justify-center vibelink-logo text-4xl">Twiqo</div>;
  }
  if (!user) return <Navigate to="/auth" />;
  if (onboarded === false && pathname !== "/onboarding") return <Navigate to="/onboarding" />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
