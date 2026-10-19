import { pageSEO } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ChevronLeft, Folder } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/saved")({
  staticData: { sitemap: false },
  head: () => pageSEO("Saved • VibeLink", "Your saved VibeLink posts.", "/saved"),
  component: Saved,
});

interface Collection { id: string; name: string; cover?: string | null; count: number }

function Saved() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [allPosts, setAllPosts] = useState<{ id: string; image_url: string }[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: saved } = await supabase.from("saved_posts")
      .select("post_id, collection_id, posts(id, image_url)")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    const flat = (saved ?? []).map((r) => r.posts as { id: string; image_url: string }).filter(Boolean);
    setAllPosts(flat);

    const { data: cols } = await supabase.from("saved_collections")
      .select("id, name").eq("user_id", user.id).order("created_at", { ascending: false });
    const map = new Map<string, Collection>();
    (cols ?? []).forEach((c) => map.set(c.id, { id: c.id, name: c.name, count: 0, cover: null }));
    (saved ?? []).forEach((r) => {
      if (!r.collection_id) return;
      const c = map.get(r.collection_id); if (!c) return;
      c.count++;
      const p = r.posts as { image_url: string } | null;
      if (!c.cover && p) c.cover = p.image_url;
    });
    setCollections(Array.from(map.values()));
  };

  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("saved_collections").insert({ user_id: user.id, name: name.trim() });
    if (error) toast.error(error.message);
    else { setName(""); setOpen(false); load(); toast.success("Collection created"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <Link to="/home" className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold">Saved</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><button className="p-1"><Plus className="h-6 w-6" /></button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
            <Input placeholder="Name (e.g. Travel, Food)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={create} disabled={!name.trim()} className="rounded-full">Create</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
          {allPosts[0] ? (
            <SignedImage path={allPosts[0].image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Folder className="h-10 w-10" /></div>
          )}
          <div className="absolute bottom-2 left-2 bg-background/90 px-2 py-1 rounded text-xs font-semibold">All posts · {allPosts.length}</div>
        </div>
        {collections.map((c) => (
          <div key={c.id} className="aspect-square bg-muted rounded-lg overflow-hidden relative">
            {c.cover ? (
              <SignedImage path={c.cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Folder className="h-10 w-10" /></div>
            )}
            <div className="absolute bottom-2 left-2 bg-background/90 px-2 py-1 rounded text-xs font-semibold truncate max-w-[80%]">{c.name} · {c.count}</div>
          </div>
        ))}
      </div>

      {allPosts.length > 0 && (
        <>
          <div className="px-4 pt-4 pb-2 text-sm font-semibold">All saved</div>
          <div className="grid grid-cols-3 gap-[2px]">
            {allPosts.map((p) => (
              <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="aspect-square bg-muted">
                <SignedImage path={p.image_url} alt="" className="w-full h-full object-cover" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
