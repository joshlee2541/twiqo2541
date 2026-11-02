import { test } from "node:test";
import { strict as assert } from "node:assert";
import "fake-indexeddb/auto";
import { saveDraft, listDrafts, getDraft, deleteDraft, draftToFile } from "./offline-drafts";

const blob = () => new Blob(["fake-image-bytes"], { type: "image/jpeg" });

async function clearDrafts() {
  for (const d of await listDrafts()) await deleteDraft(d.id);
}

test("saves a draft and lists it newest first", async () => {
  await clearDrafts();
  const id = await saveDraft({ caption: "hello", location: "Nairobi", blob: blob(), fileName: "a.jpg", fileType: "image/jpeg", autoPost: false });
  assert.ok(id);
  const all = await listDrafts();
  assert.equal(all.length, 1);
  assert.equal(all[0].caption, "hello");
  assert.ok(all[0].blob instanceof Blob);
});

test("upserts by id instead of duplicating", async () => {
  await clearDrafts();
  const id = await saveDraft({ caption: "v1", location: "", blob: null, fileName: "", fileType: "", autoPost: false });
  await saveDraft({ id, caption: "v2", location: "", blob: null, fileName: "", fileType: "", autoPost: false });
  const all = await listDrafts();
  assert.equal(all.length, 1);
  assert.equal(all[0].caption, "v2");
});

test("marks auto-post drafts and deletes them", async () => {
  await clearDrafts();
  const id = await saveDraft({ caption: "queued", location: "", blob: null, fileName: "", fileType: "", autoPost: true });
  assert.equal((await getDraft(id))?.autoPost, true);
  await deleteDraft(id);
  assert.equal(await getDraft(id), undefined);
  assert.equal((await listDrafts()).length, 0);
});

test("rebuilds an uploadable file from the stored photo", async () => {
  await clearDrafts();
  const id = await saveDraft({ caption: "", location: "", blob: blob(), fileName: "pic.jpg", fileType: "image/jpeg", autoPost: false });
  const f = draftToFile((await getDraft(id))!);
  assert.ok(f instanceof File);
  assert.equal(f!.name, "pic.jpg");
  assert.equal(f!.type, "image/jpeg");
  assert.ok(f!.size > 0);
});
