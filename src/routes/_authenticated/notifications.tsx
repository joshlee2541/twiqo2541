import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Activity • VibeLink" }] }),
  component: Notifications,
});

function Notifications() {
  return (
    <div className="px-6 py-16 text-center">
      <Heart className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="mt-4 text-lg font-semibold">Activity On Your Posts</h2>
      <p className="text-sm text-muted-foreground mt-2">When someone likes or comments on your posts, you'll see it here.</p>
    </div>
  );
}
