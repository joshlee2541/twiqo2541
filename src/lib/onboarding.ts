// Browser-safe onboarding helpers: interests, username rules, draft persistence.
// Pure logic lives here so it can be tested without the DOM.

export const INTERESTS = [
  "Technology", "Entertainment", "Sports", "Music", "Fashion", "Business",
  "Gaming", "News", "Education", "Photography", "Comedy", "Lifestyle",
] as const;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export type UsernameCheck = "empty" | "too_short" | "too_long" | "bad_chars" | "ok";

export function validateUsername(raw: string): UsernameCheck {
  const u = raw.trim();
  if (u.length === 0) return "empty";
  if (u.length < USERNAME_MIN) return "too_short";
  if (u.length > USERNAME_MAX) return "too_long";
  if (!USERNAME_RE.test(u)) return "bad_chars";
  return "ok";
}

export const USERNAME_MESSAGES: Record<Exclude<UsernameCheck, "ok" | "empty">, string> = {
  too_short: `Username must be at least ${USERNAME_MIN} characters.`,
  too_long: `Username must be at most ${USERNAME_MAX} characters.`,
  bad_chars: "Only letters, numbers and underscores are allowed.",
};

export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"] as const;
export const PRONOUN_OPTIONS = ["She/Her", "He/Him", "They/Them", "Prefer not to say"] as const;

export const PRIVACY_CHOICES = [
  { value: "everyone", label: "Everyone", hint: "Anyone on Twiqo." },
  { value: "following", label: "People you follow", hint: "Accounts you follow." },
  { value: "off", label: "No one", hint: "Turned off completely." },
] as const;

export type PrivacyValue = (typeof PRIVACY_CHOICES)[number]["value"];

export interface OnboardingDraft {
  step: number;
  avatarPath: string | null;
  avatarPreview: string | null;
  full_name: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  dob: string;
  gender: string;
  pronouns: string;
  interests: string[];
  followedIds: string[];
  is_private: boolean;
  reply_visibility: PrivacyValue;
  mention_permission: PrivacyValue;
  message_permission: PrivacyValue;
}

export const DRAFT_KEY = "twiqo-onboarding-draft";

export function emptyDraft(): OnboardingDraft {
  return {
    step: 0,
    avatarPath: null,
    avatarPreview: null,
    full_name: "",
    username: "",
    bio: "",
    location: "",
    website: "",
    dob: "",
    gender: "",
    pronouns: "",
    interests: [],
    followedIds: [],
    is_private: false,
    reply_visibility: "everyone",
    mention_permission: "everyone",
    message_permission: "everyone",
  };
}

const STRING_FIELDS = ["full_name", "username", "bio", "location", "website", "dob", "gender", "pronouns"] as const;
const PRIVACY_FIELDS = ["reply_visibility", "mention_permission", "message_permission"] as const;

/** Parses a stored draft, tolerating missing/unknown fields; returns null if unusable. */
export function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const draft = emptyDraft();
  if (typeof o.step === "number" && o.step >= 0 && o.step <= 7) draft.step = Math.floor(o.step);
  if (typeof o.avatarPath === "string" || o.avatarPath === null) draft.avatarPath = o.avatarPath as string | null;
  if (typeof o.avatarPreview === "string" || o.avatarPreview === null) draft.avatarPreview = o.avatarPreview as string | null;
  for (const f of STRING_FIELDS) if (typeof o[f] === "string") draft[f] = o[f] as string;
  if (Array.isArray(o.interests)) draft.interests = o.interests.filter((x): x is string => typeof x === "string");
  if (Array.isArray(o.followedIds)) draft.followedIds = o.followedIds.filter((x): x is string => typeof x === "string");
  if (typeof o.is_private === "boolean") draft.is_private = o.is_private;
  const validPrivacy = PRIVACY_CHOICES.map((c) => c.value);
  for (const f of PRIVACY_FIELDS) if (typeof o[f] === "string" && (validPrivacy as string[]).includes(o[f] as string)) draft[f] = o[f] as PrivacyValue;
  return draft;
}

export function serializeDraft(d: OnboardingDraft): string {
  return JSON.stringify(d);
}
