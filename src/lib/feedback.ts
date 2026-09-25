/**
 * Pure logic for the feedback widget.
 *
 * Kept out of the component so it can be unit-tested in the node
 * environment, per the "pure functions for business logic" convention.
 */

export const MAX_FEEDBACK_LENGTH = 2000;
export const FEEDBACK_COOLDOWN_MS = 30_000;
export const FEEDBACK_STORAGE_KEY = "commandzone:feedback:last-submit";

export type FeedbackIntent = "bug" | "idea";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "too-long" };

export function validateMessage(message: string): ValidationResult {
  if (message.trim().length === 0) return { ok: false, reason: "empty" };
  // Intentionally checks the raw (untrimmed) length against the cap, not
  // the trimmed length: trimming here would let whitespace smuggle past
  // the visible on-screen counter, which is computed from message.length.
  if (message.length > MAX_FEEDBACK_LENGTH) return { ok: false, reason: "too-long" };
  return { ok: true };
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Deters casual spam from the publicly visible trigger. This is not a
 * security control — anyone with devtools can clear the key.
 */
export function isRateLimited(
  now: number,
  storage: Pick<Storage, "getItem"> | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(FEEDBACK_STORAGE_KEY);
    if (raw === null) return false;
    const last = Number(raw);
    if (!Number.isFinite(last)) return false;
    return now - last < FEEDBACK_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function recordSubmission(
  now: number,
  storage: Pick<Storage, "setItem"> | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(FEEDBACK_STORAGE_KEY, String(now));
  } catch {
    // A blocked or full store must never break submission.
  }
}

export type FeedbackPayload = {
  feedback: { message: string; email?: string; name?: string; associatedEventId?: string };
  hint: { captureContext: { tags: { intent: FeedbackIntent; route: string } } };
};

export function buildFeedbackPayload(input: {
  message: string;
  email: string;
  name?: string | null;
  intent: FeedbackIntent;
  route: string;
  lastEventId: string | undefined;
}): FeedbackPayload {
  const email = input.email.trim();
  const name = input.name?.trim() ?? "";
  const feedback: FeedbackPayload["feedback"] = { message: input.message.trim() };

  if (email.length > 0) feedback.email = email;
  // Omitted entirely (never sent as ""), same treatment as email: an
  // absent name must not overwrite anything useful Sentry might infer.
  if (name.length > 0) feedback.name = name;

  // Only a bug report gets linked to an error event: hanging a feature
  // request off an unrelated stack trace is worse than no link at all.
  if (input.intent === "bug" && input.lastEventId) {
    feedback.associatedEventId = input.lastEventId;
  }

  return {
    feedback,
    hint: { captureContext: { tags: { intent: input.intent, route: input.route } } },
  };
}
