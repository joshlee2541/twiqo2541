import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Realtime "Active now" / "Last seen" system.
 *
 * Privacy model (mirrors Instagram):
 *  - profiles.show_activity_status controls sharing.
 *  - If you turn it OFF, nobody sees you as active AND you can't see anyone else.
 *  - Enforced server-side by the get_presence() security-definer function; the
 *    realtime channel only tracks you when your own setting is ON.
 */

const ONLINE_WINDOW_MS = 60_000;

type Listener = () => void;

const onlineIds = new Set<string>();
const lastSeenMap = new Map<string, string>();
const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
let sharingSelf = false;
let selfId: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

/** Called once from the app root when a user is signed in. */
export async function initPresence(userId: string) {
  if (selfId === userId && channel) return;
  await teardownPresence();
  selfId = userId;

  const { data: me } = await supabase
    .from("profiles")
    .select("show_activity_status")
    .eq("id", userId)
    .maybeSingle();
  sharingSelf = me?.show_activity_status !== false;

  const ch = supabase.channel("presence:online", { config: { presence: { key: userId } } });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState();
    onlineIds.clear();
    Object.keys(state).forEach((k) => onlineIds.add(k));
    emit();
  });
  await ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && sharingSelf) {
      await ch.track({ user_id: userId, at: new Date().toISOString() });
    }
  });
  channel = ch;
}

export async function teardownPresence() {
  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }
  onlineIds.clear();
  lastSeenMap.clear();
  selfId = null;
  emit();
}

/** Re-apply sharing when the user flips the Activity Status switch. */
export async function setPresenceSharing(on: boolean) {
  sharingSelf = on;
  if (!channel || !selfId) return;
  if (on) await channel.track({ user_id: selfId, at: new Date().toISOString() });
  else await channel.untrack();
  emit();
}

export interface PresenceInfo {
  online: boolean;
  lastSeen: string | null;
  /** true when we're allowed to show anything at all for this user */
  visible: boolean;
}

const EMPTY: PresenceInfo = { online: false, lastSeen: null, visible: false };

/**
 * Subscribe to presence for a set of user ids.
 * Returns a map of userId -> PresenceInfo (only for users whose status is visible to you).
 */
export function usePresence(ids: (string | null | undefined)[]): Record<string, PresenceInfo> {
  const key = useMemo(() => Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(","), [ids]);
  const [, force] = useState(0);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  // Server-side privacy-filtered last_seen fetch (also refreshes periodically)
  useEffect(() => {
    if (!key) { setAllowed(new Set()); return; }
    let cancelled = false;
    const list = key.split(",");
    const load = async () => {
      const { data } = await supabase.rpc("get_presence", { _ids: list });
      if (cancelled) return;
      const next = new Set<string>();
      (data ?? []).forEach((r: { user_id: string; last_seen_at: string | null }) => {
        next.add(r.user_id);
        if (r.last_seen_at) lastSeenMap.set(r.user_id, r.last_seen_at);
      });
      setAllowed(next);
      force((n) => n + 1);
    };
    load();
    const iv = setInterval(load, 45_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [key]);

  // Live updates from the presence channel + a ticker so labels stay fresh
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const iv = setInterval(l, 30_000);
    return () => { listeners.delete(l); clearInterval(iv); };
  }, []);

  return useMemo(() => {
    const out: Record<string, PresenceInfo> = {};
    (key ? key.split(",") : []).forEach((id) => {
      if (!allowed.has(id)) { out[id] = EMPTY; return; }
      const lastSeen = lastSeenMap.get(id) ?? null;
      const recent = lastSeen ? Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS : false;
      out[id] = { online: onlineIds.has(id) || recent, lastSeen, visible: true };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, allowed, force]);
}

/** Convenience for a single user. */
export function useUserPresence(id: string | null | undefined): PresenceInfo {
  const map = usePresence([id]);
  return (id && map[id]) || EMPTY;
}
