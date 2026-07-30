import { cn } from "@/lib/utils";
import { activeStatus } from "@/lib/timeAgo";
import { useUserPresence } from "@/lib/presence";

/** Green dot — realtime, privacy-aware. Pass userId; lastSeen is only a fallback. */
export function OnlineDot({
  userId,
  lastSeen,
  className,
  size = 12,
}: { userId?: string | null; lastSeen?: string | null; className?: string; size?: number }) {
  const p = useUserPresence(userId);
  const online = userId ? p.online : activeStatus(lastSeen).online;
  if (!online) return null;
  return (
    <span
      className={cn("absolute bottom-0 right-0 rounded-full bg-[#22c55e] border-2 border-background", className)}
      style={{ width: size, height: size }}
      aria-label="Active now"
    />
  );
}

/** "Active now" / "Active 5m ago" — hidden when the user hides their activity status. */
export function ActiveLabel({
  userId,
  lastSeen,
  className,
}: { userId?: string | null; lastSeen?: string | null; className?: string }) {
  const p = useUserPresence(userId);
  let label = "";
  if (userId) {
    if (!p.visible) return null;
    label = p.online ? "Active now" : activeStatus(p.lastSeen).label;
  } else {
    label = activeStatus(lastSeen).label;
  }
  if (!label) return null;
  return <span className={cn("text-xs text-muted-foreground", className)}>{label}</span>;
}
