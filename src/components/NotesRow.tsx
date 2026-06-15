import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "./Avatar";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface NoteUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  note_id: string;
}

export function NotesRow() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteUser[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("notes")
      .select("id, user_id, content, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (!data?.length) { setNotes([]); return; }
    const uids = [...new Set(data.map((n) => n.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", uids);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    setNotes(data.map((n) => {
      const p = pmap.get(n.user_id);
      return {
        user_id: n.user_id, note_id: n.id, content: n.content,
        username: p?.username ?? "user", avatar_url: p?.avatar_url ?? null,
      };
    }));
  };

  useEffect(() => { load(); }, []);

  const myNote = notes.find((n) => n.user_id === user?.id);
  const others = notes.filter((n) => n.user_id !== user?.id);

  const post = async () => {
    const t = text.trim(); if (!t || !user) return;
    setBusy(true);
    const { error } = await supabase.from("notes").insert({ user_id: user.id, content: t });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Note posted for 24h");
    setText(""); setOpen(false); load();
  };

  const remove = async () => {
    if (!myNote) return;
    await supabase.from("notes").delete().eq("id", myNote.note_id);
    load();
  };

  return (
    <div className="border-b border-border">
      <div className="flex gap-4 overflow-x-auto px-4 py-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
              <div className="relative">
                <UserAvatar path={null} username={user?.email ?? "Y"} size={56} />
                {myNote ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-muted px-2 py-0.5 rounded-full text-[10px] max-w-[80px] truncate border border-border">
                    {myNote.content}
                  </div>
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                    <Plus className="h-3 w-3" />
                  </span>
                )}
              </div>
              <span className="text-xs truncate w-full text-center">Your note</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Leave a note</DialogTitle></DialogHeader>
            <Input maxLength={60} placeholder="Share a thought…" value={text} onChange={(e) => setText(e.target.value)} />
            <p className="text-xs text-muted-foreground">{text.length}/60 · Disappears in 24h</p>
            <DialogFooter className="gap-2">
              {myNote && (
                <Button variant="outline" onClick={remove}>
                  <X className="h-4 w-4 mr-1" /> Delete current
                </Button>
              )}
              <Button onClick={post} disabled={!text.trim() || busy}>Share</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {others.map((n) => (
          <div key={n.note_id} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
            <div className="relative">
              <UserAvatar path={n.avatar_url} username={n.username} size={56} />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-muted px-2 py-0.5 rounded-full text-[10px] max-w-[90px] truncate border border-border">
                {n.content}
              </div>
            </div>
            <span className="text-xs truncate w-full text-center">{n.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
