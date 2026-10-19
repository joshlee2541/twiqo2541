import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/create")({
  staticData: { sitemap: false },
  head: () => pageSEO("Create post • VibeLink", "Share a photo on VibeLink.", "/create"),
  component: CreatePost,
});

const schema = z.object({
  caption: z.string().trim().max(2200).optional(),
  location: z.string().trim().max(100).optional(),
});

function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  const pickFile = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !user) return;
    const parsed = schema.safeParse({ caption, location });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const path = await uploadMedia(user.id, file);
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: path,
        caption: caption.trim() || null,
        location: location.trim() || null,
      });
      if (error) throw error;
      toast.success("Posted!");
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/home" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-semibold text-center mb-4">New post</h1>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Link to="/create-reel" className="rounded-xl border border-border py-2 text-center text-sm font-medium">New reel</Link>
        <Link to="/golive" className="rounded-xl bg-destructive text-destructive-foreground py-2 text-center text-sm font-semibold">Go live</Link>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {!preview ? (
        <button
          onClick={pickFile}
          className="w-full aspect-square bg-muted rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-3"
        >
          <ImagePlus className="h-12 w-12 text-muted-foreground" />
          <span className="text-sm font-medium">Tap to select a photo</span>
        </button>
      ) : (
        <>
          <img src={preview} alt="Preview" className="w-full aspect-square object-cover rounded-lg" />
          <button onClick={pickFile} className="text-xs text-primary font-semibold mt-2">Choose another</button>
        </>
      )}

      <div className="space-y-3 mt-4">
        <Textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          maxLength={2200}
        />
        <Input
          placeholder="Add location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
        <Button onClick={submit} disabled={!file || busy} className="w-full h-11 font-semibold">
          {busy ? "Sharing..." : "Share"}
        </Button>
      </div>
    </div>
  );
}
