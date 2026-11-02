import { pageSEO } from "@/lib/seo";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  staticData: { sitemap: false },
  head: () => pageSEO("Twiqo — Share photos, reels and connect with friends", "Share photos and reels, discover creators, and connect with friends on Twiqo.", "/", true),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center twiqo-logo text-5xl">Twiqo</div>;
  }
  return <Navigate to={user ? "/home" : "/auth"} />;
}
