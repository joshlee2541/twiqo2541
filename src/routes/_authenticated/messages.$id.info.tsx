import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Crown, UserPlus, LogOut, Search, Trash2, Shield, ShieldOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$id/info")({
  head: () => ({ meta: [{ title: "Group info • VibeLink" }] }),
  component: GroupInfo,
});

interface Member {
  user_id: string;
  role: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

function GroupInfo() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conv, setConv] = useState<{ name: string | null; avatar_url: string | null; is_group: boolean; created_by: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const meRole = members.find((m) => m.user_id === user?.id)?.role;
  const isAdmin = meRole === "admin";

  const load = async () => {
    const { data: c } = await supabase.from("conversations")
      .select("name, avatar_url, is_group, created_by").eq("id", id).maybeSingle();
    if (!c) return;
    setConv(c);
    setNameInput(c.name ?? "");
    const { data: mems } = await supabase.from("conversation_members")
      .select("user_id, role").eq("conversation_id", id);
    if (!mems?.length) { setMembers([]); return; }
    const { data: profs } = await supabase.from("profiles")
      .select("id, username, full_name, avatar_url").in("id", mems.map((m) => m.user_id));
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    setMembers(mems.map((m) => {
      const p = pmap.get(m.user_id);
      return {
        user_id: m.user_id, role: m.role,
        username: p?.username ?? "user",
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    }).sort((a, b) => (a.role === "admin" ? -1 : 1) - (b.role === "admin" ? -1 : 1)));
  };

  useEffect(() => { load(); }, [id]);

  if (!conv) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!conv.is_group) {
    return <div className="p-8 text-center text-muted-foreground">Not a group conversation.</div>;
  }

  const saveName = async () => {
    if (!nameInput.trim()) return;
    const { error } = await supabase.rpc("update_group_meta", { _conv: id, _name: nameInput.trim(), _avatar_url: null as unknown as string });
    if (error) toast.error(error.message);
    else { setEditingName(false); load(); toast.success("Group updated"); }
  };

  const remove = async (uid: string) => {
    const { error } = await supabase.rpc("remove_group_member", { _conv: id, _user: uid });
    if (error) toast.error(error.message); else load();
  };

  const setRole = async (uid: string, role: "admin" | "member") => {
    const { error } = await supabase.rpc("set_group_member_role", { _conv: id, _user: uid, _role: role });
    if (error) toast.error(error.message); else load();
  };

  const leave = async () => {
    const { error } = await supabase.rpc("leave_group", { _conv: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Left group");
    navigate({ to: "/messages" });
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Link to="/messages/$id" params={{ id }} className="p-1"><ChevronLeft className="h-6 w-6" /></Link>
        <h1 className="text-lg font-semibold">Group info</h1>
      </div>

      <div className="p-6 flex flex-col items-center gap-3 border-b border-border">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/30 to-accent flex items-center justify-center text-3xl font-bold text-primary">
          {(conv.name ?? "G")[0]?.toUpperCase()}
        </div>
        {editingName ? (
          <div className="flex gap-2 w-full max-w-xs">
            <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
            <Button size="sm" onClick={saveName}>Save</Button>
          </div>
        ) : (
          <button onClick={() => isAdmin && setEditingName(true)} className="text-xl font-bold">
            {conv.name} {isAdmin && <span className="text-xs text-muted-foreground ml-1">(tap to edit)</span>}
          </button>
        )}
        <div className="text-xs text-muted-foreground">{members.length} members</div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Members</h2>
        {isAdmin && <AddMemberSheet convId={id} onAdded={load} existing={members.map((m) => m.user_id)} />}
      </div>

      <ul>
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <UserAvatar path={m.avatar_url} username={m.username} size={44} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-1">
                {m.username}
                {m.role === "admin" && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                {m.user_id === user?.id && <span className="text-xs text-muted-foreground">(you)</span>}
              </div>
              {m.full_name && <div className="text-xs text-muted-foreground truncate">{m.full_name}</div>}
            </div>
            {isAdmin && m.user_id !== user?.id && (
              <>
                {m.role === "admin" ? (
                  <button onClick={() => setRole(m.user_id, "member")} className="p-2" aria-label="Demote"><ShieldOff className="h-4 w-4 text-muted-foreground" /></button>
                ) : (
                  <button onClick={() => setRole(m.user_id, "admin")} className="p-2" aria-label="Promote"><Shield className="h-4 w-4 text-muted-foreground" /></button>
                )}
                <button onClick={() => remove(m.user_id)} className="p-2 text-destructive" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="p-4">
        <Button onClick={leave} variant="destructive" className="w-full rounded-full">
          <LogOut className="h-4 w-4 mr-2" /> Leave group
        </Button>
      </div>
    </div>
  );
}

function AddMemberSheet({ convId, onAdded, existing }: { convId: string; onAdded: () => void; existing: string[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; full_name: string | null; avatar_url: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const { data } = await supabase.from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      setResults((data ?? []).filter((p) => !existing.includes(p.id)));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, user, existing]);

  const add = async (uid: string) => {
    const { error } = await supabase.rpc("add_group_member", { _conv: convId, _user: uid });
    if (error) toast.error(error.message);
    else { toast.success("Member added"); onAdded(); setQ(""); setResults([]); }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 text-primary" aria-label="Add member"><UserPlus className="h-5 w-5" /></button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col">
        <SheetHeader><SheetTitle>Add member</SheetTitle></SheetHeader>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input autoFocus placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-full bg-muted border-none" />
        </div>
        <ul className="flex-1 overflow-y-auto mt-3 -mx-6">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => add(r.id)} className="w-full flex items-center gap-3 px-6 py-2 hover:bg-accent/50">
                <UserAvatar path={r.avatar_url} username={r.username} size={40} />
                <div className="text-left flex-1">
                  <div className="font-semibold">{r.username}</div>
                  {r.full_name && <div className="text-xs text-muted-foreground">{r.full_name}</div>}
                </div>
                <span className="text-xs text-primary">Add</span>
              </button>
            </li>
          ))}
          {q && !results.length && <li className="text-center text-sm text-muted-foreground py-4">No users found</li>}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
