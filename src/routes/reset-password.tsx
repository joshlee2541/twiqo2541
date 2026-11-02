import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => pageSEO("Reset password — Twiqo", "Reset your Twiqo account password.", "/reset-password", false),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Min 6 chars"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 bg-card border border-border rounded-lg p-8">
        <h1 className="twiqo-logo text-4xl text-center mb-4">Twiqo</h1>
        <h2 className="text-center font-semibold">Set a new password</h2>
        <Input type="password" placeholder="New password" aria-label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
        <Button disabled={busy} type="submit" className="w-full h-10 font-semibold">{busy ? "Saving..." : "Update password"}</Button>
      </form>
    </div>
  );
}
