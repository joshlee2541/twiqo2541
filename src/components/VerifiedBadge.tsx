import { cn } from "@/lib/utils";

interface Props {
  verified?: boolean | null;
  verifiedUntil?: string | null;
  size?: number;
  className?: string;
}

// VibeLink verified checkmark (brand violet)
export function VerifiedBadge({ verified, verifiedUntil, size = 14, className }: Props) {
  if (!verified) return null;
  if (verifiedUntil && new Date(verifiedUntil).getTime() < Date.now()) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0 align-text-bottom", className)}
      aria-label="Verified"
    >
      <path
        d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 .96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"
        style={{ fill: "var(--primary)" }}
      />
    </svg>
  );
}
