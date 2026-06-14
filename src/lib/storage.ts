import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vibelink-media";
const cache = new Map<string, { url: string; exp: number }>();

export async function getSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.exp > now) return cached.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, exp: now + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadMedia(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
