import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number with country code");

const CODE_TTL_MS = 10 * 60 * 1000;

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function syntheticEmail(phone: string) {
  return `p${phone.replace(/\D/g, "")}@phone.vibelink.app`;
}

async function sendSms(phone: string, text: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovableKey || !brevoKey) throw new Error("SMS is not configured");

  const res = await fetch("https://connector-gateway.lovable.dev/brevo/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": brevoKey,
    },
    body: JSON.stringify({
      sender: "VibeLink",
      recipient: phone.replace(/^\+/, ""),
      content: text,
      type: "transactional",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[Brevo SMS] ${res.status}: ${body}`);
    throw new Error(`Could not send the code: ${body}`);
  }
}

/** Step 1 — send a 6-digit code by SMS. */
export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; mode: "login" | "signup" }) =>
    z.object({ phone: phoneSchema, mode: z.enum(["login", "signup"]) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (data.mode === "login" && !existing) {
      throw new Error("No account is registered with that number");
    }
    if (data.mode === "signup" && existing) {
      throw new Error("That number is already registered — log in instead");
    }

    // Basic rate limit: max 3 codes per number per 15 minutes.
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Too many codes requested. Try again in a few minutes.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabaseAdmin.from("phone_verifications").insert({
      phone,
      code_hash: await sha256(code),
      purpose: data.mode,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (error) throw new Error(error.message);

    await sendSms(phone, `${code} is your VibeLink code. It expires in 10 minutes.`);
    return { sent: true as const };
  });

/** Step 2 — verify the code, create the account if needed, and return a one-time login token. */
export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      phone: string;
      code: string;
      mode: "login" | "signup";
      fullName?: string;
      username?: string;
      password?: string;
    }) =>
      z
        .object({
          phone: phoneSchema,
          code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
          mode: z.enum(["login", "signup"]),
          fullName: z.string().trim().min(1).max(80).optional(),
          username: z
            .string()
            .trim()
            .min(3)
            .max(30)
            .regex(/^[a-z0-9_.]+$/)
            .optional(),
          password: z.string().min(6).max(72).optional(),
        })
        .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone;

    const { data: row } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("Request a new code");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("That code expired");
    if (row.attempts >= 5) throw new Error("Too many attempts. Request a new code.");

    if (row.code_hash !== (await sha256(data.code))) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Incorrect code");
    }

    await supabaseAdmin
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    let email = syntheticEmail(phone);

    if (data.mode === "signup") {
      if (!data.fullName || !data.username || !data.password) {
        throw new Error("Missing account details");
      }
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .maybeSingle();
      if (taken) throw new Error("That username is taken");

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, username: data.username, phone },
      });
      if (createErr || !created.user) throw new Error(createErr?.message ?? "Could not create account");

      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ phone })
        .eq("id", created.user.id);
      if (profErr) console.error("[phone-auth] profile phone update", profErr.message);
    } else {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (!prof) throw new Error("No account is registered with that number");
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(prof.id);
      if (!userRes?.user?.email) throw new Error("No account is registered with that number");
      email = userRes.user.email;
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error(linkErr?.message ?? "Could not complete sign in");
    }

    return { tokenHash: link.properties.hashed_token };
  });
