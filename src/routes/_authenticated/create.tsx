import { pageSEO } from "@/lib/seo";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Clock, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/storage";
import {
  listDrafts, saveDraft, deleteDraft, draftToFile, type OfflineDraft,
} from "@/lib/offline-drafts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { timeAgo } from "@/lib/timeAgo";

export const Route = createFileRoute("/_authenticated/create")({
  staticData: { sitemap: false },
  head: () => pageSEO("Create post • Twiqo", "Share a photo on Twiqo.", "/create"),
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
  const draftIdRef = useRef<string | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const refreshDrafts = useCallback(async () => {
    try {
      const all = await listDrafts();
      setDrafts(all);
      setThumbs((prev) => {
        for (const url of Object.values(prev)) URL.revokeObjectURL(url);
        const next: Record<string, string> = {};
        for (const d of all) if (d.blob) next[d.id] = URL.createObjectURL(d.blob);
        return next;
      });
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => { void refreshDrafts(); }, [refreshDrafts]);

  // Auto-save the draft as the user types (debounced).
  useEffect(() => {
    const hasContent = Boolean(file || caption.trim() || location.trim());
    if (!hasContent) return;
    const t = setTimeout(() => {
      saveDraft({
        id: draftIdRef.current,
        caption,
        location,
        blob: file,
        fileName: file?.name ?? "",
        fileType: file?.type ?? "",
        autoPost: false,
      })
        .then((id) => { draftIdRef.current = id; })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [file, caption, location]);

  const pickFile = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const saveAsAutoPost = useCallback(async () => {
    if (!file && !caption.trim() && !location.trim()) return false;
    const id = await saveDraft({
      id: draftIdRef.current,
      caption,
      location,
      blob: file,
      fileName: file?.name ?? "",
      fileType: file?.type ?? "",
      autoPost: true,
    });
    draftIdRef.current = id;
    toast.info("No connection — your post is saved and will publish automatically when you're back online.");
    return true;
  }, [file, caption, location]);

  const publishDraft = useCallback(async (d: OfflineDraft) => {
    if (!user) return;
    if (!navigator.onLine) {
      await saveDraft({ ...d, autoPost: true });
      toast.info("No connection — we'll post it automatically when you're back online.");
      void refreshDrafts();
      return;
    }
    setPublishingId(d.id);
    try {
      const f = draftToFile(d);
      if (!f) { await deleteDraft(d.id); return; }
      const path = await uploadMedia(user.id, f);
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: path,
        caption: d.caption.trim() || null,
        location: d.location.trim() || null,
      });
      if (error) throw error;
      await deleteDraft(d.id);
      toast.success("Posted!");
      qc.invalidateQueries({ queryKey: ["feed"] });
      if (draftIdRef.current === d.id) draftIdRef.current = undefined;
    } catch (e: unknown) {
      if (!navigator.onLine) {
        await saveDraft({ ...d, autoPost: true });
        toast.info("No connection — we'll post it automatically when you're back online.");
      } else {
        toast.error(e instanceof Error ? e.message : "Couldn't publish draft");
      }
    } finally {
      setPublishingId(null);
      void refreshDrafts();
    }
  }, [user, qc, refreshDrafts]);

  // Publish queued drafts automatically when the connection comes back.
  const publishRef = useRef(publishDraft);
  publishRef.current = publishDraft;
  useEffect(() => {
    const onOnline = async () => {
      const queued = (await listDrafts()).filter((d) => d.autoPost);
      for (const d of queued) await publishRef.current(d);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const restoreDraft = (d: OfflineDraft) => {
    setCaption(d.caption);
    setLocation(d.location);
    draftIdRef.current = d.id;
    if (d.blob) {
      const f = draftToFile(d)!;
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const removeDraft = async (d: OfflineDraft) => {
    await deleteDraft(d.id);
    if (draftIdRef.current === d.id) draftIdRef.current = undefined;
    void refreshDrafts();
  };

  const submit = async () => {
    if (!file || !user) return;
    const parsed = schema.safeParse({ caption, location });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!navigator.onLine) { await saveAsAutoPost(); return; }
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
      if (draftIdRef.current) await deleteDraft(draftIdRef.current);
      draftIdRef.current = undefined;
      setFile(null); setPreview(null); setCaption(""); setLocation("");
      toast.success("Posted!");
      void refreshDrafts();
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/home" });
    } catch (e: unknown) {
      if (!navigator.onLine) {
        await saveAsAutoPost();
      } else {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
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
        <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Clock className="h-3 w-3" />
          Drafts save automatically on this device — post them anytime, even offline.
        </p>
      </div>

      {drafts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-2">
            Drafts on this device ({drafts.length})
          </h2>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                {thumbs[d.id] ? (
                  <img src={thumbs[d.id]} alt="Draft" className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.caption || <span className="text-muted-foreground">No caption</span>}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Saved {timeAgo(d.created_at)}
                    {d.autoPost && <span className="text-primary">• posts when back online</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={publishingId === d.id}
                  onClick={() => restoreDraft(d)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={publishingId === d.id}
                  onClick={() => publishDraft(d)}
                >
                  {publishingId === d.id ? "Posting…" : "Post"}
                </Button>
                <button
                  aria-label="Delete draft"
                  onClick={() => removeDraft(d)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
