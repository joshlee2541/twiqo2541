// Instagram-style relative time
export function timeAgo(iso: string | Date | null | undefined, opts?: { short?: boolean }): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  const short = opts?.short ?? false;
  if (s < 60) return short ? `${s}s` : `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return short ? `${m}m` : `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return short ? `${h}h` : `${h} hour${h === 1 ? "" : "s"} ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return short ? `${day}d` : `${day} day${day === 1 ? "" : "s"} ago`;
  const w = Math.floor(day / 7);
  if (w < 5) return short ? `${w}w` : `${w} week${w === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

// "Active now" / "Active 5m ago" / "Active today" — like Instagram
export function activeStatus(lastSeen: string | null | undefined): { online: boolean; label: string } {
  if (!lastSeen) return { online: false, label: "" };
  const t = new Date(lastSeen).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return { online: true, label: "Active now" };
  const m = Math.floor(diff / 60_000);
  if (m < 60) return { online: false, label: `Active ${m}m ago` };
  const h = Math.floor(m / 60);
  if (h < 24) return { online: false, label: `Active ${h}h ago` };
  const d = Math.floor(h / 24);
  if (d === 1) return { online: false, label: "Active yesterday" };
  if (d < 7) return { online: false, label: `Active ${d}d ago` };
  return { online: false, label: "Active a while ago" };
}
