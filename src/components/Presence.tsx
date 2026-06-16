import { cn } from "@/lib/utils";
import { activeStatus } from "@/lib/timeAgo";

export function OnlineDot({ lastSeen, className, size = 12 }: { lastSeen: string | null | undefined; className?: string; size?: number }) {
  const { online } = activeStatus(lastSeen);
  if (!online) return null;
  return (
    <span
      className={cn("absolute bottom-0 right-0 rounded-full bg-[#22c55e] border-2 border-background", className)}
      style={{ width: size, height: size }}
      aria-label="Online"
    />
  );
}

export function ActiveLabel({ lastSeen, className }: { lastSeen: string | null | undefined; className?: string }) {
  const { label } = activeStatus(lastSeen);
  if (!label) return null;
  return <span className={cn("text-xs text-muted-foreground", className)}>{label}</span>;
}
