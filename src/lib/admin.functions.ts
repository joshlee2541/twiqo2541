// Twiqo verification admin operations. Every handler verifies the caller's
// role through the caller's own token first, then uses the privileged client.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = ReturnType<typeof import("@supabase/supabase-js").createClient<Database>>;

async function getAdminClient(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertAdmin(supabase: AdminClient | unknown): Promise<void> {
  const { data, error } = await (supabase as AdminClient).rpc("is_twiqo_admin");
  if (error || !data) throw new Error("Forbidden: Twiqo admin access required");
}

async function assertFounder(context: { supabase: AdminClient; userId: string }): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "founder",
  });
  if (error || !data) throw new Error("Forbidden: Founder access required");
}

export interface AdminApplication {
  id: string;
  user_id: string;
  full_legal_name: string;
  username: string;
  country: string;
  category: string;
  reason: string;
  website_url: string | null;
  social_links: string[] | null;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    verified: boolean;
    country: string | null;
    created_at: string;
  } | null;
}

export const adminListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; search?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();

    let query = supabase
      .from("verification_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.search && data.search.trim()) {
      const term = data.search.trim().replace(/[%,_]/g, "");
      query = query.or(`username.ilike.%${term}%,full_legal_name.ilike.%${term}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const profileMap = new Map<string, AdminApplication["profile"]>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, verified, country, created_at")
        .in("id", ids);
      for (const p of profs ?? []) profileMap.set(p.id, p);
    }

    return {
      applications: (rows ?? []).map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null })),
    };
  });

export const adminGetApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();

    const { data: app, error } = await supabase
      .from("verification_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("Application not found");

    const { data: docs } = await supabase
      .from("verification_documents")
      .select("id, storage_path, file_name, mime_type, created_at")
      .eq("application_id", app.id)
      .order("created_at", { ascending: true });

    // Signed read URLs for the private documents bucket — admins only.
    const documents = await Promise.all(
      (docs ?? []).map(async (d) => {
        const { data: url } = await supabase.storage
          .from("vibelink-verification")
          .createSignedUrl(d.storage_path, 60 * 60);
        return { ...d, url: url?.signedUrl ?? null };
      })
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, verified, country, created_at")
      .eq("id", app.user_id)
      .maybeSingle();

    return { application: { ...app, profile: profile ?? null, documents } };
  });

export const adminReviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; decision: "approve" | "reject" | "request_info"; reason?: string }) => input
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();

    const { data: app } = await supabase
      .from("verification_applications")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!app) throw new Error("Application not found");

    const status = data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "info_requested";
    const adminNote = (data.reason ?? "").trim() || null;

    const { error: upErr } = await supabase
      .from("verification_applications")
      .update({
        status,
        admin_note: adminNote,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.id);
    if (upErr) throw new Error(upErr.message);

    if (data.decision === "approve") {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: true })
        .eq("id", app.user_id);
      if (error) throw new Error(error.message);
    }

    const action = data.decision === "approve" ? "application_approved"
      : data.decision === "reject" ? "application_rejected" : "application_info_requested";
    await supabase.from("verification_audit_logs").insert({
      actor_id: context.userId,
      action,
      target_user_id: app.user_id,
      application_id: app.id,
      note: adminNote,
    });

    const notifType = data.decision === "approve" ? "verification_approved"
      : data.decision === "reject" ? "verification_rejected" : "verification_info_requested";
    await supabase.from("notifications").insert({
      recipient_id: app.user_id,
      actor_id: context.userId,
      type: notifType,
    });

    return { ok: true, status };
  });

export const adminGrantVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertFounder(context);
    const supabase = await getAdminClient();

    const { error } = await supabase.from("profiles").update({ verified: true }).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabase.from("verification_audit_logs").insert({
      actor_id: context.userId,
      action: "verification_granted",
      target_user_id: data.userId,
      note: (data.note ?? "").trim() || null,
    });

    await supabase.from("notifications").insert({
      recipient_id: data.userId,
      actor_id: context.userId,
      type: "verification_approved",
    });

    return { ok: true };
  });

export const adminRevokeVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertFounder(context);
    const supabase = await getAdminClient();

    const { error } = await supabase.from("profiles").update({ verified: false }).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabase.from("verification_audit_logs").insert({
      actor_id: context.userId,
      action: "verification_revoked",
      target_user_id: data.userId,
      note: (data.note ?? "").trim() || null,
    });

    return { ok: true };
  });

export const adminSearchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();
    const term = data.q.trim().replace(/[%,_]/g, "");
    if (!term) return { users: [] };
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, verified, country, created_at")
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { users: rows ?? [] };
  });

export interface CountryStat {
  country: string;
  count: number;
  pct: number;
}

export const adminCountryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rangeDays: number | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();

    const { count: total } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    const { count: active } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gt("last_seen_at", new Date(Date.now() - 7 * 86400_000).toISOString());
    const { count: verified } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verified", true);

    let rowsQuery = supabase.from("profiles").select("country, created_at");
    if (data.rangeDays != null) {
      rowsQuery = rowsQuery.gte("created_at", new Date(Date.now() - data.rangeDays * 86400_000).toISOString());
    }
    const { data: rows, error } = await rowsQuery;
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const c = r.country || "unknown";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const byCountry: CountryStat[] = [...counts.entries()]
      .map(([country, count]) => ({
        country,
        count,
        pct: total ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const growth = new Map<string, number>();
    for (const r of rows ?? []) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      growth.set(day, (growth.get(day) ?? 0) + 1);
    }
    const growthSeries = [...growth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalRegistered: total ?? 0,
      activeUsers: active ?? 0,
      verifiedUsers: verified ?? 0,
      countriesTracked: [...counts.keys()].filter((c) => c !== "unknown").length,
      byCountry,
      growthSeries,
    };
  });

export const adminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase);
    const supabase = await getAdminClient();
    const { data: rows, error } = await supabase
      .from("verification_audit_logs")
      .select("id, actor_id, action, target_user_id, application_id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).flatMap((r) => [r.actor_id, r.target_user_id]).filter((x): x is string => !!x))];
    const profs = new Map<string, string>();
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, username").in("id", ids);
      for (const row of p ?? []) profs.set(row.id, row.username);
    }
    return {
      entries: (rows ?? []).map((r) => ({
        ...r,
        actor_username: profs.get(r.actor_id) ?? "unknown",
        target_username: r.target_user_id ? profs.get(r.target_user_id) ?? "unknown" : null,
      })),
    };
  });
