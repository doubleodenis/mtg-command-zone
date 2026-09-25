# Feedback & Bug Report Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a floating bottom-right button, present on every route, that lets any visitor send a bug report or an idea straight to Sentry's User Feedback inbox.

**Architecture:** A single client component (`FeedbackWidget`) mounted once in the root layout renders the trigger and an anchored panel built from existing `ui/` primitives. All decision logic — rate-limit cooldown, length validation, payload shape — lives in pure functions in `src/lib/feedback.ts` so it is testable in the existing node environment. The component calls `Sentry.captureFeedback()` directly from the browser; there is no server action, API route, table, or migration.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Tailwind CSS 4, Framer Motion, `@sentry/nextjs` ^10.48.0, Vitest 4 (+ jsdom and Testing Library, added by Task 1), lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-24-feedback-widget-design.md`

## Global Constraints

- TypeScript strict — no `any`, anywhere in this work.
- Trigger position is exactly `fixed bottom-4 right-4 z-50`, plus `env(safe-area-inset-bottom)` padding.
- Trigger is 44×44px minimum (touch target) and carries a **bug** icon, never a question mark.
- Message cap: **2000 characters**. Constant name: `MAX_FEEDBACK_LENGTH`.
- Cooldown: **one submission per 30 seconds** (`FEEDBACK_COOLDOWN_MS = 30_000`), persisted in `localStorage` under the key `commandzone:feedback:last-submit`.
- Every `localStorage` read and write is wrapped in try/catch; a throwing or blocked store degrades to "not rate limited", never to a broken form.
- Intent values are the exact strings `"bug"` and `"idea"`. Default is `"bug"`.
- `associatedEventId` is attached **only** when intent is `"bug"` **and** `Sentry.lastEventId()` returns a non-empty value.
- Email is always optional. Never block submission on a missing email.
- Use the existing `toast()` helper from `@/components/ui/toast` for success and error feedback. Do not build new notification UI.
- Reuse `Button`, `Input`, `Card` from `@/components/ui`. Do not write new primitives.
- Prettier formats on commit conventions already in the repo; run `npm run lint` before each commit.

### Deviation from the spec, already agreed

The spec's §6 assumed Testing Library was available. It is not — `vitest.config.ts` runs `environment: 'node'`, coverage excludes `src/components/**`, and all five existing suites are pure-logic tests. Task 1 therefore adds jsdom + Testing Library, and logic is extracted into `src/lib/feedback.ts` (a file the spec's table does not list). This was confirmed with the user on 2026-09-25 before planning.

One further simplification: the root layout already awaits `supabase.auth.getUser()`. The widget receives `defaultEmail` as a prop from that existing call rather than making its own browser Supabase request. No `name` field is sent — deriving a display name would require an extra profile fetch for no triage value, since the email already identifies the reporter.

---

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` (modify) | Split into two projects: `node` for `src/lib`, `jsdom` for `src/components` |
| `vitest.setup.ts` (create) | Testing Library auto-cleanup + `@testing-library/jest-dom` matchers |
| `src/lib/feedback.ts` (create) | Pure logic: constants, cooldown read/write, validation, Sentry payload builder |
| `src/lib/__tests__/feedback.test.ts` (create) | Unit tests for the above, node environment |
| `src/components/feedback/feedback-widget.tsx` (create) | Client component: trigger, panel, form state, submit handler |
| `src/components/feedback/index.ts` (create) | Barrel export, matching `src/components/ui/index.ts` convention |
| `src/components/feedback/feedback-widget.test.tsx` (create) | Component tests, jsdom environment |
| `src/app/layout.tsx` (modify) | Mount `<FeedbackWidget />` inside `<Providers>`, after `<Footer />` |

---

### Task 1: Component test infrastructure

Nothing in this repo can render a React component in a test today. This task adds that capability and proves it works, without disturbing the five existing node-environment suites.

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/components/feedback/__smoke__/smoke.test.tsx` (deleted in Step 6)
- Modify: `package.json` (devDependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: a working jsdom test project. Later tasks may write `*.test.tsx` files under `src/components/` and use `render`, `screen`, `waitFor` from `@testing-library/react` and `userEvent` from `@testing-library/user-event`.

- [ ] **Step 1: Install the dev dependencies**

```bash
npm install -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Create the setup file**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Split vitest config into two projects**

Replace the contents of `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = { '@': path.resolve(__dirname, './src') }
const exclude = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.worktrees/**']

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/app/**',
        'src/components/**',
      ],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['src/lib/**/*.{test,spec}.{ts,mts,cts}', 'scripts/**/*.{test,spec}.ts'],
          exclude,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'jsdom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/components/**/*.{test,spec}.{tsx,ts}'],
          exclude,
        },
      },
    ],
  },
})
```

If `@vitejs/plugin-react` is not already present, install it: `npm install -D @vitejs/plugin-react`.

- [ ] **Step 4: Write a smoke test that proves jsdom rendering works**

Create `src/components/feedback/__smoke__/smoke.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <button type="button">click me</button>;
}

describe("jsdom test environment", () => {
  it("renders a React component and queries it", () => {
    render(<Hello />);
    expect(screen.getByRole("button", { name: "click me" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the full suite — both projects must pass**

Run: `npm run test:run`
Expected: the smoke test PASSES under the `jsdom` project, and all five existing suites (`rating`, `confirmation`, `dirty-match-recalc`, `match-participants`, `head-to-head-meetings`) still PASS under the `node` project. If the existing suites are not picked up, the `include` globs in the `node` project are wrong — fix them before continuing.

- [ ] **Step 6: Delete the smoke test**

```bash
rm -r src/components/feedback/__smoke__
```

- [ ] **Step 7: Run the suite once more to confirm nothing else broke**

Run: `npm run test:run`
Expected: all five existing suites PASS. No jsdom tests found yet is fine.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "test: add jsdom and Testing Library for component tests"
```

---

### Task 2: Pure feedback logic

**Files:**
- Create: `src/lib/feedback.ts`
- Test: `src/lib/__tests__/feedback.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all imported by Task 3 and Task 4:
  - `const MAX_FEEDBACK_LENGTH = 2000`
  - `const FEEDBACK_COOLDOWN_MS = 30_000`
  - `const FEEDBACK_STORAGE_KEY = "commandzone:feedback:last-submit"`
  - `type FeedbackIntent = "bug" | "idea"`
  - `function validateMessage(message: string): { ok: true } | { ok: false; reason: "empty" | "too-long" }`
  - `function isRateLimited(now: number, storage?: Pick<Storage, "getItem"> | null): boolean`
  - `function recordSubmission(now: number, storage?: Pick<Storage, "setItem"> | null): void`
  - `function buildFeedbackPayload(input: { message: string; email: string; intent: FeedbackIntent; route: string; lastEventId: string | undefined }): { feedback: { message: string; email?: string; associatedEventId?: string }; hint: { captureContext: { tags: { intent: FeedbackIntent; route: string } } } }`

The `storage` parameter defaults to `globalThis.localStorage` when omitted, and is injectable so tests never touch a real store.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/feedback.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import {
  MAX_FEEDBACK_LENGTH,
  FEEDBACK_COOLDOWN_MS,
  FEEDBACK_STORAGE_KEY,
  validateMessage,
  isRateLimited,
  recordSubmission,
  buildFeedbackPayload,
} from '@/lib/feedback'

describe('validateMessage', () => {
  it('rejects an empty message', () => {
    expect(validateMessage('')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a whitespace-only message', () => {
    expect(validateMessage('   \n  ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('accepts a normal message', () => {
    expect(validateMessage('the confirm button did nothing')).toEqual({ ok: true })
  })

  it('rejects a message over the cap', () => {
    expect(validateMessage('x'.repeat(MAX_FEEDBACK_LENGTH + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    })
  })

  it('accepts a message exactly at the cap', () => {
    expect(validateMessage('x'.repeat(MAX_FEEDBACK_LENGTH))).toEqual({ ok: true })
  })
})

describe('isRateLimited', () => {
  it('is not limited when nothing has been submitted', () => {
    const storage = { getItem: () => null }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is limited immediately after a submission', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000, storage)).toBe(true)
  })

  it('is limited part-way through the cooldown', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000 + FEEDBACK_COOLDOWN_MS - 1, storage)).toBe(true)
  })

  it('is not limited once the cooldown has elapsed', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000 + FEEDBACK_COOLDOWN_MS, storage)).toBe(false)
  })

  it('is not limited when the stored value is garbage', () => {
    const storage = { getItem: () => 'not-a-number' }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is not limited when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError: site data blocked')
      },
    }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is not limited when storage is unavailable', () => {
    expect(isRateLimited(1_000_000, null)).toBe(false)
  })
})

describe('recordSubmission', () => {
  it('writes the timestamp under the shared key', () => {
    const setItem = vi.fn()
    recordSubmission(1_234_567, { setItem })
    expect(setItem).toHaveBeenCalledWith(FEEDBACK_STORAGE_KEY, '1234567')
  })

  it('swallows a throwing storage', () => {
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => recordSubmission(1_234_567, { setItem })).not.toThrow()
  })

  it('does nothing when storage is unavailable', () => {
    expect(() => recordSubmission(1_234_567, null)).not.toThrow()
  })
})

describe('buildFeedbackPayload', () => {
  it('tags the intent and the route', () => {
    const { hint } = buildFeedbackPayload({
      message: 'rating went down after a win',
      email: 'player@example.com',
      intent: 'bug',
      route: '/match/abc',
      lastEventId: undefined,
    })
    expect(hint.captureContext.tags).toEqual({ intent: 'bug', route: '/match/abc' })
  })

  it('trims the message and includes the email', () => {
    const { feedback } = buildFeedbackPayload({
      message: '  spacing is off  ',
      email: 'player@example.com',
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.message).toBe('spacing is off')
    expect(feedback.email).toBe('player@example.com')
  })

  it('omits the email entirely when blank', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'anonymous report',
      email: '   ',
      intent: 'bug',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.email).toBeUndefined()
    expect('email' in feedback).toBe(false)
  })

  it('attaches the last event id for a bug report', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'it crashed',
      email: '',
      intent: 'bug',
      route: '/matches/new',
      lastEventId: 'abc123',
    })
    expect(feedback.associatedEventId).toBe('abc123')
  })

  it('never attaches an event id to an idea', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'add a dark mode toggle',
      email: '',
      intent: 'idea',
      route: '/',
      lastEventId: 'abc123',
    })
    expect(feedback.associatedEventId).toBeUndefined()
  })

  it('omits the event id for a bug when none exists', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'confusing copy',
      email: '',
      intent: 'bug',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.associatedEventId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- feedback`
Expected: FAIL — `Failed to resolve import "@/lib/feedback"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/feedback.ts`:

```ts
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
  feedback: { message: string; email?: string; associatedEventId?: string };
  hint: { captureContext: { tags: { intent: FeedbackIntent; route: string } } };
};

export function buildFeedbackPayload(input: {
  message: string;
  email: string;
  intent: FeedbackIntent;
  route: string;
  lastEventId: string | undefined;
}): FeedbackPayload {
  const email = input.email.trim();
  const feedback: FeedbackPayload["feedback"] = { message: input.message.trim() };

  if (email.length > 0) feedback.email = email;

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- feedback`
Expected: PASS, 21 tests.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/feedback.ts src/lib/__tests__/feedback.test.ts
git commit -m "feat: add pure logic for feedback widget"
```

---

### Task 3: Widget shell — trigger and panel

Renders the button and the open/close behavior. Submission is stubbed here and wired up in Task 4, so this task can be reviewed on its interaction and accessibility behavior alone.

**Files:**
- Create: `src/components/feedback/feedback-widget.tsx`
- Create: `src/components/feedback/index.ts`
- Test: `src/components/feedback/feedback-widget.test.tsx`

**Interfaces:**
- Consumes: `FeedbackIntent`, `MAX_FEEDBACK_LENGTH` from `@/lib/feedback` (Task 2).
- Produces: `export function FeedbackWidget(props: { defaultEmail?: string | null }): JSX.Element`, re-exported from `src/components/feedback/index.ts`. Task 5 mounts this.

- [ ] **Step 1: Write the failing tests**

Create `src/components/feedback/feedback-widget.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackWidget } from "./feedback-widget";

vi.mock("next/navigation", () => ({ usePathname: () => "/leaderboards" }));

describe("FeedbackWidget — shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a labelled trigger that is collapsed by default", () => {
    render(<FeedbackWidget />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the panel when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send feedback" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("defaults the intent to bug", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("radio", { name: "Bug" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Idea" })).not.toBeChecked();
  });

  it("swaps the placeholder when the intent changes", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/your feedback/i)).toHaveAttribute(
      "placeholder",
      "What happened, and what did you expect instead?"
    );
    await user.click(screen.getByRole("radio", { name: "Idea" }));
    expect(screen.getByLabelText(/your feedback/i)).toHaveAttribute(
      "placeholder",
      "What would make CommandZone better?"
    );
  });

  it("prefills the email when one is supplied", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget defaultEmail="player@example.com" />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/email/i)).toHaveValue("player@example.com");
  });

  it("leaves the email blank for a signed-out visitor", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });

  it("shows a live character counter", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.type(screen.getByLabelText(/your feedback/i), "hello");
    expect(screen.getByText(`5 / ${MAX_FEEDBACK_LENGTH}`)).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes when Cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

Add `MAX_FEEDBACK_LENGTH` to the imports at the top of the test file:

```tsx
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- feedback-widget`
Expected: FAIL — cannot resolve `./feedback-widget`.

- [ ] **Step 3: Write the implementation**

Create `src/components/feedback/feedback-widget.tsx`:

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_FEEDBACK_LENGTH, type FeedbackIntent } from "@/lib/feedback";
import { transition } from "@/lib/motion";

const PLACEHOLDERS: Record<FeedbackIntent, string> = {
  bug: "What happened, and what did you expect instead?",
  idea: "What would make CommandZone better?",
};

interface FeedbackWidgetProps {
  /** The signed-in user's email, when there is one. */
  defaultEmail?: string | null;
}

export function FeedbackWidget({ defaultEmail }: FeedbackWidgetProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const [intent, setIntent] = React.useState<FeedbackIntent>("bug");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail ?? "");

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Escape closes from anywhere while the panel is open.
  React.useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // A click outside the panel and outside the trigger closes it.
  React.useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Send feedback"
            aria-modal="false"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={transition.fast}
            style={{ transformOrigin: "bottom right" }}
            className="w-80 rounded-lg border border-card-border bg-card p-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-ui font-semibold text-text-1">Send feedback</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close feedback form"
                className="rounded p-1 text-text-3 transition-colors hover:text-text-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              role="radiogroup"
              aria-label="Feedback type"
              className="mb-3 flex gap-2"
            >
              {(["bug", "idea"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={intent === value}
                  onClick={() => setIntent(value)}
                  className={cn(
                    "text-ui flex-1 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                    intent === value
                      ? "border-accent-ring bg-accent-fill text-text-1"
                      : "border-card-border bg-transparent text-text-2 hover:border-card-border-hi"
                  )}
                >
                  {value === "bug" ? "Bug" : "Idea"}
                </button>
              ))}
            </div>

            <label htmlFor="feedback-message" className="mb-1 block text-sm text-text-2">
              Your feedback
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
              placeholder={PLACEHOLDERS[intent]}
              rows={4}
              maxLength={MAX_FEEDBACK_LENGTH}
              className={cn(
                "w-full resize-none rounded-md border border-card-border bg-card px-3 py-2",
                "text-base text-text-1 placeholder:text-text-2",
                "focus:border-accent-ring focus:outline-none focus:ring-1 focus:ring-accent-ring"
              )}
            />
            <p
              className={cn(
                "mt-1 text-right text-xs",
                message.length >= MAX_FEEDBACK_LENGTH * 0.9 ? "text-warning" : "text-text-3"
              )}
            >
              {message.length} / {MAX_FEEDBACK_LENGTH}
            </p>

            <label htmlFor="feedback-email" className="mb-1 mt-2 block text-sm text-text-2">
              Email <span className="text-text-3">(optional)</span>
            </label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button type="button" size="sm">
                Send
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        ref={triggerRef}
        type="button"
        size="icon"
        aria-label="Send feedback"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((open) => !open)}
        className="h-11 w-11 rounded-full"
      >
        <Bug className="h-5 w-5" />
      </Button>
    </div>
  );
}
```

Create `src/components/feedback/index.ts`:

```ts
export { FeedbackWidget } from "./feedback-widget";
```

Note: `pathname` is read here but only consumed in Task 4. Leave the `usePathname()` call in place; Task 4's submit handler uses it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- feedback-widget`
Expected: PASS, 9 tests.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors. If the unused-variable rule flags `pathname`, leave it and silence nothing — Task 4 consumes it in the next commit; if lint blocks the commit, move Task 4's Step 3 forward rather than adding a disable comment.

- [ ] **Step 6: Commit**

```bash
git add src/components/feedback/
git commit -m "feat: add feedback widget trigger and panel"
```

---

### Task 4: Submit handler

**Files:**
- Modify: `src/components/feedback/feedback-widget.tsx`
- Test: `src/components/feedback/feedback-widget.test.tsx` (append a second `describe`)

**Interfaces:**
- Consumes: everything from `@/lib/feedback` (Task 2), the component from Task 3.
- Produces: no new exports. `FeedbackWidget`'s signature is unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/feedback/feedback-widget.test.tsx`:

```tsx
import * as Sentry from "@sentry/nextjs";
import { toast } from "@/components/ui/toast";
import { FEEDBACK_STORAGE_KEY } from "@/lib/feedback";

vi.mock("@sentry/nextjs", () => ({
  captureFeedback: vi.fn(),
  lastEventId: vi.fn(() => undefined),
}));

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

async function openAndType(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Send feedback" }));
  await user.type(screen.getByLabelText(/your feedback/i), text);
  return user;
}

describe("FeedbackWidget — submission", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(Sentry.captureFeedback).mockReset();
    vi.mocked(Sentry.lastEventId).mockReturnValue(undefined);
    vi.mocked(toast).mockReset();
  });

  it("does not submit an empty message", async () => {
    const user = userEvent.setup();
    render(<FeedbackWidget />);
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends the message, email and intent tag", async () => {
    render(<FeedbackWidget defaultEmail="player@example.com" />);
    const user = await openAndType("rating dropped after a win");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      { message: "rating dropped after a win", email: "player@example.com" },
      { captureContext: { tags: { intent: "bug", route: "/leaderboards" } } }
    );
  });

  it("attaches the last event id to a bug report", async () => {
    vi.mocked(Sentry.lastEventId).mockReturnValue("evt-42");
    render(<FeedbackWidget />);
    const user = await openAndType("it crashed");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0][0]).toMatchObject({
      associatedEventId: "evt-42",
    });
  });

  it("never attaches an event id to an idea", async () => {
    vi.mocked(Sentry.lastEventId).mockReturnValue("evt-42");
    render(<FeedbackWidget />);
    const user = await openAndType("add a dark mode toggle");
    await user.click(screen.getByRole("radio", { name: "Idea" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0][0]).not.toHaveProperty(
      "associatedEventId"
    );
  });

  it("shows a success toast and closes the panel", async () => {
    render(<FeedbackWidget />);
    const user = await openAndType("looks great");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" })
    );
  });

  it("blocks a second submission inside the cooldown", async () => {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, String(Date.now()));
    render(<FeedbackWidget />);
    const user = await openAndType("second try");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: "warning" }));
  });

  it("keeps the typed message when sending fails", async () => {
    vi.mocked(Sentry.captureFeedback).mockImplementation(() => {
      throw new Error("network down");
    });
    render(<FeedbackWidget />);
    const user = await openAndType("this should survive");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/your feedback/i)).toHaveValue("this should survive");
  });
});
```

Add `waitFor` to the Testing Library import at the top of the file:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- feedback-widget`
Expected: FAIL — the Send button does nothing, so `captureFeedback` is never called.

- [ ] **Step 3: Wire up the handler**

In `src/components/feedback/feedback-widget.tsx`, extend the imports:

```tsx
import * as Sentry from "@sentry/nextjs";
import { toast } from "@/components/ui/toast";
import {
  MAX_FEEDBACK_LENGTH,
  buildFeedbackPayload,
  isRateLimited,
  recordSubmission,
  validateMessage,
  type FeedbackIntent,
} from "@/lib/feedback";
```

Add state and the handler inside the component, after the existing `close` callback:

```tsx
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;

    const validation = validateMessage(message);
    if (!validation.ok) {
      toast({
        type: "warning",
        title: validation.reason === "empty" ? "Add a message first" : "Message is too long",
      });
      return;
    }

    const now = Date.now();
    if (isRateLimited(now)) {
      toast({
        type: "warning",
        title: "Hang on a moment",
        description: "You can send more feedback in a few seconds.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { feedback, hint } = buildFeedbackPayload({
        message,
        email,
        intent,
        route: pathname,
        lastEventId: Sentry.lastEventId(),
      });
      Sentry.captureFeedback(feedback, hint);
      recordSubmission(now);

      toast({
        type: "success",
        title: "Thanks — that's been sent",
        description: "We read every report.",
      });
      setMessage("");
      setIsOpen(false);
    } catch {
      // Keep the panel open and the text intact: losing a paragraph of
      // feedback to a network blip is how you never hear from someone again.
      toast({
        type: "error",
        title: "Couldn't send that",
        description: "Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
```

Replace the Send button with:

```tsx
              <Button type="button" size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send"}
              </Button>
```

Note the success path calls `setIsOpen(false)` directly rather than `close()`, because returning focus to the trigger is only correct for an explicit dismissal.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- feedback-widget`
Expected: PASS, 16 tests across both describes.

- [ ] **Step 5: Run the whole suite**

Run: `npm run test:run`
Expected: all node and jsdom suites PASS.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/feedback/
git commit -m "feat: submit feedback to Sentry from the widget"
```

---

### Task 5: Mount in the root layout and verify in the browser

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `FeedbackWidget` from `@/components/feedback` (Task 3).
- Produces: nothing.

- [ ] **Step 1: Mount the widget**

In `src/app/layout.tsx`, add the import:

```tsx
import { FeedbackWidget } from "@/components/feedback";
```

The layout already awaits `supabase.auth.getUser()`, so reuse that `user`. Inside `<Providers>`, after `<Footer />`:

```tsx
        <Providers userId={user?.id}>
          <div className="flex-1 flex flex-col bg-black/30 backdrop-blur-[2px]">
            {children}
          </div>
          <Footer />
          <FeedbackWidget defaultEmail={user?.email ?? null} />
        </Providers>
```

- [ ] **Step 2: Build to confirm the server/client boundary is correct**

Run: `npm run build`
Expected: build succeeds. A failure mentioning hooks in a Server Component means the `"use client"` directive at the top of `feedback-widget.tsx` was lost — restore it.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev` and open `http://localhost:3001`.

Check each of these by hand:
1. The button sits at the bottom-right on `/` while signed out, and the email field is empty when opened.
2. Signed in, the email field is prefilled.
3. The panel opens, Escape closes it, and clicking outside closes it.
4. A real submission produces the success toast — then confirm the report arrives in Sentry's **User Feedback** inbox with `intent` and `route` tags.
5. Submitting again within 30 seconds produces the "Hang on a moment" toast.

- [ ] **Step 4: Check for overlap on bottom-heavy routes**

This is the open question flagged in the spec. Visit each of `/matches/new`, `/match/[id]` for a real match, `/decks`, and `/collections` at a 390px-wide viewport, and confirm the trigger does not cover a fixed bottom action bar or mobile navigation.

If it does overlap: add a route-aware offset inside `FeedbackWidget` — derive it from the `pathname` the component already reads, e.g. `bottom-20` for the affected prefixes — rather than moving the other element. Add a test for the offset in `feedback-widget.test.tsx` mirroring the existing `usePathname` mock, then re-run `npm run test:run`.

If it does not overlap, record that in the commit message so the question is closed.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: mount feedback widget in the root layout"
```

- [ ] **Step 6: Update the spec's status line**

In `docs/superpowers/specs/2026-09-24-feedback-widget-design.md`, change the `**Status:**` line to `Implemented on `feat/feedback-widget`.` and note the outcome of the overlap check from Step 4.

```bash
git add docs/superpowers/specs/2026-09-24-feedback-widget-design.md
git commit -m "docs: mark feedback widget spec implemented"
```

---

## Verification

The work is done when all of the following hold, with output seen rather than assumed:

- `npm run test:run` — all node and jsdom suites pass, including the 21 logic tests and 16 component tests added here.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- A test submission from the browser appears in Sentry's User Feedback inbox, carrying the `intent` and `route` tags.
- The overlap check in Task 5 Step 4 has been performed on all four routes and its outcome recorded.
