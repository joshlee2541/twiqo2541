/**
 * Offline post drafts, stored in the browser's IndexedDB.
 * All browser access happens inside functions — never at module scope (SSR-safe).
 */
export interface OfflineDraft {
  id: string;
  caption: string;
  location: string;
  blob: Blob | null;
  fileName: string;
  fileType: string;
  /** Set when the user asked to publish while offline; posted automatically on reconnect. */
  autoPost: boolean;
  created_at: string;
}

type DraftInput = Omit<OfflineDraft, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

const DB_NAME = "vibelink-drafts";
const STORE = "drafts";
const VERSION = 1;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

/** Saves (upserts) a draft and returns its id. */
export async function saveDraft(draft: DraftInput): Promise<string> {
  if (!hasIDB()) return "";
  const id = draft.id ?? crypto.randomUUID();
  const rec: OfflineDraft = {
    ...draft,
    id,
    created_at: draft.created_at ?? new Date().toISOString(),
  };
  await tx("readwrite", (s) => s.put(rec) as unknown as IDBRequest<IDBValidKey>);
  return id;
}

/** All drafts, newest first. */
export async function listDrafts(): Promise<OfflineDraft[]> {
  if (!hasIDB()) return [];
  const all = await tx("readonly", (s) => s.getAll() as IDBRequest<OfflineDraft[]>);
  return (all ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDraft(id: string): Promise<OfflineDraft | undefined> {
  if (!hasIDB()) return undefined;
  return tx("readonly", (s) => s.get(id) as IDBRequest<OfflineDraft | undefined>);
}

export async function deleteDraft(id: string): Promise<void> {
  if (!hasIDB()) return;
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** Rebuilds an uploadable File from a stored draft photo. */
export function draftToFile(draft: OfflineDraft): File | null {
  if (!draft.blob) return null;
  return new File([draft.blob], draft.fileName || "photo.jpg", {
    type: draft.fileType || "image/jpeg",
  });
}
