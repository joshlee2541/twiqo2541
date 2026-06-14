import { SignedImage } from "./SignedImage";
import { cn } from "@/lib/utils";

interface Props {
  path: string | null | undefined;
  username: string;
  size?: number;
  ring?: boolean;
  className?: string;
}

export function UserAvatar({ path, username, size = 32, ring, className }: Props) {
  const initial = username?.[0]?.toUpperCase() ?? "?";
  const img = (
    <div
      className={cn(
        "rounded-full overflow-hidden bg-gradient-to-br from-muted to-secondary flex items-center justify-center text-foreground font-semibold",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {path ? (
        <SignedImage path={path} alt={username} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
  if (!ring) return img;
  return (
    <div className="story-ring inline-flex">
      <div className="bg-background rounded-full p-[2px]">{img}</div>
    </div>
  );
}
