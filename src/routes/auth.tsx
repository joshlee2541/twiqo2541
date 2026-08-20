import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { signInWithPhone, signUpWithPhone } from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logoAsset from "@/assets/vibelink-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Log in • VibeLink" }] }),
  component: AuthPage,
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Required").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number with country code, e.g. +15550001234");

const signupDetailsSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(80),
  username: z.string().trim().min(3, "Min 3 chars").max(30).regex(/^[a-z0-9_.]+$/, "lowercase, numbers, _ or . only"),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signupSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  fullName: z.string().trim().min(1, "Required").max(80),
  username: z.string().trim().min(3, "Min 3 chars").max(30).regex(/^[a-z0-9_.]+$/, "lowercase, numbers, _ or . only"),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [method, setMethod] = useState<"email" | "phone">("email");
  if (loading) return null;
  if (user) return <Navigate to="/home" />;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-lg px-8 py-10 flex flex-col items-center">
          <img src={logoAsset.url} alt="VibeLink" className="h-20 w-20 rounded-2xl mb-4 mt-2 shadow-md" />
          <h1 className="vibelink-logo text-4xl mb-6">VibeLink</h1>

          <div className="w-full grid grid-cols-2 gap-1 p-1 mb-4 rounded-lg bg-muted">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-8 rounded-md text-sm font-semibold capitalize transition-colors ${
                  method === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          {method === "email" ? (
            mode === "login" ? <LoginForm /> : <SignupForm onDone={() => setMode("login")} />
          ) : (
            <PhoneAuthForm mode={mode} onDone={() => setMode("login")} />
          )}
        </div>
        <div className="bg-card border border-border rounded-lg mt-3 py-4 text-center text-sm">
          {mode === "login" ? (
            <>Don't have an account?{" "}
              <button onClick={() => setMode("signup")} className="text-primary font-semibold">Sign up</button>
            </>
          ) : (
            <>Have an account?{" "}
              <button onClick={() => setMode("login")} className="text-primary font-semibold">Log in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneAuthForm({ mode, onDone }: { mode: "login" | "signup"; onDone: () => void }) {
  const navigate = useNavigate();
  const phoneSignUp = useServerFn(signUpWithPhone);
  const phoneSignIn = useServerFn(signInWithPhone);

  const [phone, setPhone] = useState("+");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (mode === "signup") {
      const ok = signupDetailsSchema.safeParse({ fullName, username, password });
      if (!ok.success) { toast.error(ok.error.issues[0].message); return; }
    } else if (password.length < 6) {
      toast.error("At least 6 characters");
      return;
    }

    setBusy(true);
    try {
      const { email } =
        mode === "signup"
          ? await phoneSignUp({
              data: {
                phone: phone.trim(),
                fullName: fullName.trim(),
                username: username.trim().toLowerCase(),
                password,
              },
            })
          : await phoneSignIn({ data: { phone: phone.trim(), password } });

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      toast.success(mode === "signup" ? "Welcome to VibeLink!" : "Logged in");
      onDone();
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full space-y-2">
      <p className="text-sm text-muted-foreground text-center mb-3">
        {mode === "signup"
          ? "Sign up with your phone number and a password."
          : "Log in with your phone number and password."}
      </p>
      <Input
        type="tel"
        placeholder="+1 555 000 0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
        className="h-11 bg-muted border-border"
        autoComplete="tel"
      />
      {mode === "signup" && (
        <>
          <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 bg-muted border-border" autoComplete="name" />
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 bg-muted border-border" autoComplete="username" />
        </>
      )}
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-muted border-border pr-10"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      <Button type="submit" disabled={busy} className="w-full h-10 rounded-lg font-semibold">
        {busy ? (mode === "signup" ? "Creating..." : "Logging in...") : mode === "signup" ? "Sign up" : "Log in"}
      </Button>
    </form>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    let email = identifier.trim();
    if (!email.includes("@")) {
      const { data, error: rpcErr } = await supabase.rpc("get_email_by_username", { _username: email.toLowerCase() });
      if (rpcErr || !data) { setBusy(false); toast.error("No account with that username"); return; }
      email = data as string;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/home" });
  };

  const onForgot = async () => {
    if (!identifier.includes("@")) { toast.error("Enter your email above first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <form onSubmit={onSubmit} className="w-full space-y-2">
      <Input
        type="text"
        placeholder="Username or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        className="h-11 bg-muted border-border"
        autoComplete="username"
      />
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-muted border-border pr-10"
          autoComplete="current-password"
        />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      <Button type="submit" disabled={busy} className="w-full h-10 rounded-lg font-semibold">
        {busy ? "Logging in..." : "Log in"}
      </Button>
      <div className="flex items-center gap-3 my-4">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs uppercase text-muted-foreground font-semibold">or</span>
        <div className="h-px bg-border flex-1" />
      </div>
      <button type="button" onClick={onForgot} className="w-full text-center text-xs text-primary py-2">
        Forgot password?
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast.error("Please accept the terms"); return; }
    const parsed = signupSchema.safeParse({ email, fullName, username, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim(), username: username.trim().toLowerCase() },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created — check your email to confirm");
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="w-full space-y-2">
      <p className="text-sm text-muted-foreground text-center mb-3">
        Sign up to see photos and videos from friends.
      </p>
      <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-muted border-border" autoComplete="email" />
      <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 bg-muted border-border" autoComplete="name" />
      <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 bg-muted border-border" autoComplete="username" />
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-muted border-border pr-10"
          autoComplete="new-password"
        />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground py-2">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
        <span>I agree to VibeLink's Terms, Privacy Policy, and Cookies Policy.</span>
      </label>
      <Button type="submit" disabled={busy} className="w-full h-10 rounded-lg font-semibold">
        {busy ? "Creating..." : "Sign up"}
      </Button>
    </form>
  );
}
