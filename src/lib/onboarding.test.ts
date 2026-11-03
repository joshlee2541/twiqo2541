import { test } from "node:test";
import { strict as assert } from "node:assert";
import { validateUsername, parseDraft, serializeDraft, emptyDraft } from "./onboarding";

test("usernames allow letters, numbers and underscores", () => {
  assert.equal(validateUsername("josh_lee2"), "ok");
  assert.equal(validateUsername("A9_"), "ok");
});

test("username rules reject bad input", () => {
  assert.equal(validateUsername(""), "empty");
  assert.equal(validateUsername("ab"), "too_short");
  assert.equal(validateUsername("a".repeat(21)), "too_long");
  assert.equal(validateUsername("has space"), "bad_chars");
  assert.equal(validateUsername("no-dash"), "bad_chars");
});

test("draft round-trips through storage and survives corrupt data", () => {
  const d = { ...emptyDraft(), step: 4, username: "josh", interests: ["Music"], is_private: true };
  const back = parseDraft(serializeDraft(d));
  assert.ok(back);
  assert.equal(back.step, 4);
  assert.equal(back.username, "josh");
  assert.deepEqual(back.interests, ["Music"]);
  assert.equal(back.is_private, true);

  assert.equal(parseDraft("not json"), null);
  assert.equal(parseDraft("{}"), null); // parsed but no draft markers? step/others default
});
