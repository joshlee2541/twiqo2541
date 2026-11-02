import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import { UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/edit-profile")({
  staticData: { sitemap: false },
  head: () => pageSEO("Edit profile • Twiqo", "Manage your Twiqo profile details.", "/edit-profile"),
  component: EditProfile,
});

const schema = z.object({
  full_name: z.string().trim().max(80).optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_.]+$/),
  bio: z.string().trim().max(150).optional(),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

function EditProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", username: "", bio: "", website: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          username: data.username,
          bio: data.bio ?? "",
          website: data.website ?? "",
        });
        setAvatarPath(data.avatar_url);
      }
    });
  }, [user]);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    try {
      const path = await uploadMedia(user.id, f);
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      setAvatarPath(path);
      toast.success("Photo updated");
    } catch { toast.error("Upload failed"); }
  };

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name || null,
      username: form.username.toLowerCase(),
      bio: form.bio || null,
      website: form.website || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    navigate({ to: "/profile/$username", params: { username: form.username.toLowerCase() } });
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-lg font-semibold text-center">Edit profile</h1>
      <div className="flex flex-col items-center gap-2">
        <UserAvatar path={avatarPath} username={form.username} size={88} />
        <input ref={inputRef} type="file" accept="image/*" onChange={onAvatar} className="hidden" />
        <button onClick={() => inputRef.current?.click()} className="text-primary text-sm font-semibold">Change photo</button>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <label className="text-xs text-muted-foreground">Username</label>
        <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label className="text-xs text-muted-foreground">Bio</label>
        <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} maxLength={150} />
        <label className="text-xs text-muted-foreground">Website</label>
        <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      </div>
      <Button onClick={save} disabled={busy} className="w-full h-11 font-semibold">{busy ? "Saving..." : "Save"}</Button>
    </div>
  );
}
