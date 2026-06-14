import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center vibelink-logo text-4xl">VibeLink</div>;
  }
  if (!user) return <Navigate to="/auth" />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
