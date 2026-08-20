import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number with country code");

function syntheticEmail(phone: string) {
  return `p${phone.replace(/\D/g, "")}@phone.vibelink.app`;
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Create an account using a phone number as the identifier. */
export const signUpWithPhone = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; fullName: string; username: string; password: string }) =>
    z
      .object({
        phone: phoneSchema,
        fullName: z.string().trim().min(1).max(80),
        username: z
          .string()
          .trim()
          .min(3)
          .max(30)
          .regex(/^[a-z0-9_.]+$/),
        password: z.string().min(6).max(72),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) throw new Error("That number is already registered — log in instead");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (taken) throw new Error("That username is taken");

    const email = syntheticEmail(phone);
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

    return { email };
  });

/** Resolve a phone number to its login email after verifying the password. */
export const signInWithPhone = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; password: string }) =>
    z.object({ phone: phoneSchema, password: z.string().min(6).max(72) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();
    if (!prof) throw new Error("Incorrect phone number or password");

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(prof.id);
    const email = userRes?.user?.email;
    if (!email) throw new Error("Incorrect phone number or password");

    const { error } = await publicClient().auth.signInWithPassword({ email, password: data.password });
    if (error) throw new Error("Incorrect phone number or password");

    return { email };
  });
