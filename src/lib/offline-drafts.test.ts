import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { saveDraft, listDrafts, getDraft, deleteDraft, draftToFile } from "./offline-drafts";

const blob = () => new Blob(["fake-image-bytes"], { type: "image/jpeg" });

beforeEach(async () => {
  for (const d of await listDrafts()) await deleteDraft(d.id);
});

it("saves a draft and lists it newest first", async () => {
  const id = await saveDraft({ caption: "hello", location: "Nairobi", blob: blob(), fileName: "a.jpg", fileType: "image/jpeg", autoPost: false });
  expect(id).toBeTruthy();
  const all = await listDrafts();
  expect(all).toHaveLength(1);
  expect(all[0].caption).toBe("hello");
  expect(all[0].blob).toBeInstanceOf(Blob);
});

it("upserts by id instead of duplicating", async () => {
  const id = await saveDraft({ caption: "v1", location: "", blob: null, fileName: "", fileType: "", autoPost: false });
  await saveDraft({ id, caption: "v2", location: "", blob: null, fileName: "", fileType: "", autoPost: false });
  const all = await listDrafts();
  expect(all).toHaveLength(1);
  expect(all[0].caption).toBe("v2");
});

it("marks auto-post drafts and deletes them", async () => {
  const id = await saveDraft({ caption: "queued", location: "", blob: null, fileName: "", fileType: "", autoPost: true });
  expect((await getDraft(id))?.autoPost).toBe(true);
  await deleteDraft(id);
  expect(await getDraft(id)).toBeUndefined();
  expect(await listDrafts()).toHaveLength(0);
});

it("rebuilds an uploadable file from the stored photo", async () => {
  const id = await saveDraft({ caption: "", location: "", blob: blob(), fileName: "pic.jpg", fileType: "image/jpeg", autoPost: false });
  const f = draftToFile((await getDraft(id))!);
  expect(f).toBeInstanceOf(File);
  expect(f!.name).toBe("pic.jpg");
  expect(f!.type).toBe("image/jpeg");
  expect(f!.size).toBeGreaterThan(0);
});
