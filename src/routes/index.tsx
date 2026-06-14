import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center vibelink-logo text-5xl">VibeLink</div>;
  }
  return <Navigate to={user ? "/home" : "/auth"} />;
}
