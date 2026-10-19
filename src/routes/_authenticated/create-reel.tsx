import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create-reel")({
  staticData: { sitemap: false },
  head: () => pageSEO("New reel • VibeLink", "Create a reel on VibeLink.", "/create-reel"),
  component: CreateReel,
});

function CreateReel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Video only"); return; }
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadMedia(user.id, file);
      const { error } = await supabase.from("reels").insert({ user_id: user.id, video_url: path, caption: caption.trim() || null });
      if (error) throw error;
      toast.success("Reel posted!");
      navigate({ to: "/reels" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-semibold text-center mb-4">New reel</h1>
      <input ref={inputRef} type="file" accept="video/*" onChange={onFile} className="hidden" />
      {!preview ? (
        <button onClick={() => inputRef.current?.click()} className="w-full aspect-[9/16] max-h-[60vh] bg-muted rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-3">
          <Film className="h-12 w-12 text-muted-foreground" />
          <span className="text-sm font-medium">Tap to pick a video</span>
        </button>
      ) : (
        <video src={preview} controls className="w-full aspect-[9/16] max-h-[60vh] object-cover rounded-lg bg-black" />
      )}
      <Textarea placeholder="Caption..." value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2200} className="mt-4" />
      <Button onClick={submit} disabled={!file || busy} className="w-full h-11 mt-3 font-semibold">
        {busy ? "Uploading..." : "Share"}
      </Button>
    </div>
  );
}
