import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

  // Query-based so the onboarding flow can invalidate it on completion.
  const { data: onboarded, isPending } = useQuery({
    queryKey: ["onboarded", user?.id ?? null],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("onboarded").eq("id", user!.id).maybeSingle();
      return data?.onboarded ?? false;
    },
  });

  if (loading || (user && (isPending || onboarded === undefined))) {
    return <div className="min-h-screen flex items-center justify-center twiqo-logo text-4xl">Twiqo</div>;
  }
  if (!user) return <Navigate to="/auth" />;
  if (onboarded === false && pathname !== "/onboarding") return <Navigate to="/onboarding" search={{ step: 0 }} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
