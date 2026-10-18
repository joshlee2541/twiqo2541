import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { dispatchPush } from "./push.functions";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function bufToB64(buf: ArrayBuffer | null) {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Returns the active SW registration, or null (e.g. in preview/dev where no SW is registered). */
async function getRegistration() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ?? null;
}

export async function isPushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "Push notifications aren't supported on this browser." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Notifications permission was not granted." };
  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "Push works in the installed/published app only." };
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }));
  const { error } = await supabase.from("push_subscriptions" as never).upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: bufToB64(sub.getKey("p256dh")), auth: bufToB64(sub.getKey("auth")) } as never,
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions" as never).delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/** Fire-and-forget: ask the server to push the activity the current user just created. */
export function triggerPush() {
  dispatchPush().catch(() => {});
}
