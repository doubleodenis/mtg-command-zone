# Feedback & Bug Report Widget — Design

**Date:** 2026-09-24
**Branch:** `feat/feedback-widget`, to be cut from `main` (independent of
`fix/lock-down-function-grants` — this touches no database object, so it does
not need to wait for that branch to merge).
**Status:** Implemented on `feat/feedback-widget`. Overlap check at 390px: no
overlap found on `/match/[id]` (verified live); `/matches/new`, `/decks`, and
`/collections` are auth-gated and could not be reached without test
credentials. Two independent codebase-wide searches — one for Tailwind
fixed/sticky bottom classes, one for broader patterns including inline
`position: fixed` and CSS-in-JS forms — both found no fixed/sticky bottom
action bar or mobile nav outside the widget and toast components. That is
evidence of no conflict, not a substitute for the 390px visual check the
brief called for: `/matches/new`, `/decks`, and `/collections` still await
manual confirmation at 390px before this question can be called fully
closed.

## Motivation

The playtest puts real people in front of CommandZone for the first time. When
something breaks or feels wrong, there is currently no way for them to tell us
without leaving the app. Sentry catches crashes, but it cannot catch "the
bracket modifier explanation makes no sense" or "I expected the confirm button
here" — the feedback that actually shapes the product during a playtest.

The goal is the lowest-friction path from "that's broken" to a report we can
triage, available on every page, for signed-in and signed-out visitors alike.

## Decisions

Three choices were made up front and everything below follows from them.

**Sentry is the destination, not Postgres.** `Sentry.captureFeedback()` sends
reports to Sentry's User Feedback inbox. No `feedback` table, no migration, no
server action, no RLS policy, no admin triage UI to build. Given that the
client SDK is already initialized in `src/instrumentation-client.ts` **with
Session Replay enabled** (`replaysSessionSampleRate: 0.1`,
`replaysOnErrorSampleRate: 1.0`), a submitted report automatically carries the
replay, breadcrumbs, and release for that session when sampled. That context is
worth more for a playtest than owning the rows.

The trade-off accepted: feedback lives in Sentry's retention window and quota
rather than our own database, and we cannot join it against match or user data.
If feedback volume or long-term analysis ever justifies it, adding a Supabase
table later is additive — the widget's submit handler is the only thing that
changes.

**Custom UI, Sentry as transport.** Sentry ships its own feedback widget, but
it would arrive as a foreign object in a design system with established tokens,
fonts, and motion variants. We render our own trigger and panel from existing
primitives (`Button`, `Card`, `Input`, `toast`) and call the SDK directly. This
also keeps the ~15–20kb widget bundle out of the app.

**Visible to everyone, on every route.** Mounted in the root layout, so it
appears on public pages (`/leaderboards`, `/player/[username]`, `/match/[id]`)
as well as authed ones. A playtester who bounces off the landing page is
exactly the person whose feedback we are missing today. The cost is exposure to
drive-by spam, which the rate limit in §4 addresses.

## 1. Trigger

New client component at `src/components/feedback/feedback-widget.tsx`, mounted
once in `src/app/layout.tsx` inside `<Providers>`, after `<Footer />`.

- Positioned `fixed bottom-4 right-4 z-50`, with
  `padding-bottom: env(safe-area-inset-bottom)` so it clears the home indicator
  on iOS.
- Bottom-**right**: the conventional location for a support or feedback
  launcher, clear of the sidebar and of the bottom-left area users associate
  with cookie and consent banners.
- A 44×44px circular button — the minimum comfortable touch target — carrying a
  bug icon. A question mark was rejected: it reads as "help/docs" and sets the
  wrong expectation about what the button does.
- Accessibility: `aria-label="Send feedback"`, `aria-expanded` reflecting panel
  state, `aria-haspopup="dialog"`.

**To verify during implementation:** whether any route renders a bottom-fixed
element (mobile navigation, the new-match action bar) that the button would
overlap. If one exists, the widget takes a route-aware vertical offset rather
than the overlapping element being moved.

## 2. Panel

Clicking the trigger opens a small card anchored to the button, animated with a
Framer Motion scale/fade whose transform origin is the bottom-right corner,
using the shared variants in `src/lib/motion.ts`.

Contents:

- **Intent toggle** — `Bug` / `Idea`, rendered as two `Button` variants.
  Selecting one sets the Sentry tag (§3) and swaps the textarea placeholder:
  - Bug → "What happened, and what did you expect instead?"
  - Idea → "What would make CommandZone better?"
  Defaults to `Bug`.
- **Message** — required textarea, max 2000 characters, with a live character
  counter that turns into a warning state near the cap.
- **Email** — prefilled from the Supabase session when the visitor is signed
  in; a plain optional input when they are not. Never required: demanding an
  email is the single biggest drop-off in a feedback form, and we would rather
  have an anonymous report than none.
- **Submit** and **Cancel**.

Dismissal and focus: Escape closes, a click outside closes, focus is trapped
inside the panel while it is open, and focus returns to the trigger on close.

## 3. Transport

On submit:

```ts
Sentry.captureFeedback(
  {
    message,
    email,
    name,
    // bug reports only, and only when one exists:
    associatedEventId: Sentry.lastEventId(),
  },
  {
    captureContext: { tags: { intent, route: pathname } },
  },
)
```

- `intent` (`bug` | `idea`) and `route` (from `usePathname()`) become Sentry
  tags, so the inbox is filterable by kind and by where the report came from.
- `associatedEventId` is attached **only for bug reports, and only when
  `Sentry.lastEventId()` returns a value**. A report filed immediately after a
  crash then hangs off that exact error event. Idea submissions never attach
  one — associating a feature request with an unrelated stack trace is worse
  than no association.
- `name` and `email` come from the Supabase session when available, otherwise
  from the form's email field with `name` omitted.

No server action and no API route: `captureFeedback` is a browser-side call
against the already-initialized client SDK.

## 4. States and abuse control

State machine: `idle → submitting → success` or `idle → submitting → error`.

- **submitting** — submit button disabled and showing a pending state; the
  panel stays open.
- **success** — a success toast via the existing `toast()` helper, then the
  panel closes and the form resets.
- **error** — an error toast, the panel stays open, **and the typed message is
  preserved**. Losing someone's paragraph of feedback to a network blip is the
  fastest way to never hear from them again.

Because the trigger is public, two limits protect the Sentry quota:

- A `localStorage` cooldown of one submission per 30 seconds, enforced before
  the SDK call. `localStorage` access is wrapped in try/catch so that a browser
  blocking site data degrades to no cooldown rather than a broken form.
- The 2000-character cap from §2, enforced on the textarea and re-checked at
  submit.

These deter casual abuse. They are not a security control, and are not
presented as one: anyone willing to open devtools can bypass both. Accepted for
a playtest-scale audience; if abuse materializes, the answer is a server-side
rate limit, not a stricter client.

## 5. Out of scope

Deliberately excluded, to keep this to one component:

- Screenshot capture — Session Replay already shows what the user saw.
- File attachments.
- An in-app admin or triage view — Sentry's inbox is the triage surface.
- Any Supabase persistence, table, or migration.
- Email notification on new feedback — configured in Sentry's alert rules if
  wanted, not in application code.

## 6. Testing

Vitest with Testing Library, against a mocked `@sentry/nextjs`:

1. Submitting with an empty message is blocked and `captureFeedback` is never
   called.
2. A valid submission calls `captureFeedback` once with the typed message, the
   email, and an `intent` tag matching the selected toggle.
3. A second submission immediately after a successful one is blocked by the
   cooldown.
4. Escape closes the panel and returns focus to the trigger.
5. When `captureFeedback` rejects, the error toast fires and the typed message
   is still in the textarea.

## Files touched

| File | Change |
|---|---|
| `src/components/feedback/feedback-widget.tsx` | New — trigger, panel, submit handler |
| `src/components/feedback/index.ts` | New — barrel export, matching the convention in `src/components/ui/` |
| `src/app/layout.tsx` | Mount `<FeedbackWidget />` inside `<Providers>`, after `<Footer />` |
| `src/components/feedback/feedback-widget.test.tsx` | New — the five cases in §6 |

No migration, no server action, no change to `src/lib/supabase/`.
