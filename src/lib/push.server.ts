import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import { VAPID_PUBLIC_KEY } from "./push-config";

type Notif = { id: string; recipient_id: string; actor_id: string; type: string; post_id: string | null };

/** Sends pushes for the caller's recent un-pushed notifications. Content comes from the DB only. */
export async function dispatchPendingPushes(actorId: string) {
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!privateKey) return { sent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 5 * 60_000).toISOString();

  const { data: notifs } = await supabaseAdmin
    .from("notifications" as never)
    .select("id, recipient_id, actor_id, type, post_id")
    .eq("actor_id", actorId)
    .eq("pushed", false)
    .gte("created_at", since)
    .limit(20);
  const list = (notifs ?? []) as unknown as Notif[];
  if (!list.length) return { sent: 0 };

  await supabaseAdmin.from("notifications" as never).update({ pushed: true } as never).in("id", list.map((n) => n.id));

  const { data: actor } = await supabaseAdmin.from("profiles").select("username").eq("id", actorId).maybeSingle();
  const name = (actor as { username?: string } | null)?.username ?? "Someone";
  const vapid: VapidKeys = { subject: "mailto:notifications@vibelink.app", publicKey: VAPID_PUBLIC_KEY, privateKey };

  let sent = 0;
  for (const n of list) {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions" as never)
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", n.recipient_id);
    const body =
      n.type === "like" ? `${name} liked your post.` :
      n.type === "comment" ? `${name} commented on your post.` :
      `${name} started following you.`;
    const url = n.post_id ? `/post/${n.post_id}` : `/profile/${name}`;
    for (const s of (subs ?? []) as unknown as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
      const sub: PushSubscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        const payload = await buildPushPayload(
          { data: JSON.stringify({ title: "VibeLink", body, url, tag: `${n.type}-${n.id}` }), options: { ttl: 3600, urgency: "normal" } },
          sub,
          vapid,
        );
        const res = await fetch(s.endpoint, payload as RequestInit);
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions" as never).delete().eq("id", s.id);
        } else if (res.ok) sent++;
        else console.error("push failed", res.status, await res.text());
      } catch (e) {
        console.error("push error", e);
      }
    }
  }
  return { sent };
}
