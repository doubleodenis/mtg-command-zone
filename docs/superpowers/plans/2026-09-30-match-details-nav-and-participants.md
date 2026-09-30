# Match Details Nav + Clickable Participants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/match/[id]` the same navbar + tab links as every other page (B1),
make registered participants link to their profile, and show each participant's
deck bracket (F5 + the CLAUDE.md known issue).

**Architecture:** Add a route layout at `src/app/match/layout.tsx` that renders
`Navbar` + `TabNav`, the same as `src/app/matches/layout.tsx`, and remove the
inline navbar from the page. Move `ParticipantList` into
`src/components/match/` so it falls under the jsdom test project. Add
`username` to `ParticipantDisplayInfo` so the list can build `/player/[username]`
links.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4,
Vitest (jsdom project for `src/components/**`) + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-30-playtest-feedback-design.md`
(sections B1 and F5)

## Global Constraints

- TypeScript strict: no `any`.
- Use `cn()` for conditional classes. Match surrounding code style (the
  participant list uses double quotes and semicolons, the page uses single
  quotes and no semicolons).
- `src/types/database.types.ts` is generated. Do not edit it.
- Placeholder participants (`userId === null`) stay non-clickable.
- `/match/[id]` is a public route. Links to `/player/[username]` are public too.

## Review Focus

1. **Placeholder slot:** a slot with `userId: null` must render no link, even
   when its name looks like a username. Test in Task 2.
2. **Registered participant with no username** (profile join returned null):
   render plain text, no `/player/null` link, no crash. Test in Task 2.
3. **Action buttons inside a row** ("Claim This Slot", "Update Deck") must not
   be inside the link, so clicking them doesn't navigate. The link wraps only
   the avatar + name. Test in Task 2.
4. **Placeholder "Unknown Deck":** don't show a bracket badge. The sentinel's
   bracket is a default, not a real power level, and "Casual" would mislead.
   Test in Task 3.
5. **Out-of-range or missing bracket** (e.g. `0` or `5` from bad data):
   render no badge rather than an empty pill. Test in Task 3.

---

### Task 1: Match route layout (B1)

**Files:**
- Create: `src/app/match/layout.tsx`
- Modify: `src/app/match/[id]/page.tsx` (remove `Navbar` import at line 9 and `<Navbar />` at line 91; outer `div` → `main`)
- Modify: `src/app/match/[id]/not-found.tsx` (remove `Navbar`)
- Modify: `src/app/match/[id]/loading.tsx` (remove navbar placeholder block)

**Interfaces:**
- Consumes: `Navbar` from `@/components/features/navbar`, `TabNav` from
  `@/components/layout`, `AUTHENTICATED_NAV` from `@/lib/nav-config`
- Produces: nothing used by later tasks.

No unit test here. `Navbar` is an async server component and the jsdom
project can't render it. Verify with typecheck, build and a browser check.

- [ ] **Step 1: Create the layout**

`src/app/match/layout.tsx`. Unlike `matches/layout.tsx`, it does **not** wrap
children in `<main className="max-w-6xl …">`, because the match page has a
full-width header band (`border-b bg-card`) that must stay edge-to-edge.

```tsx
import { Navbar } from "@/components/features/navbar";
import { TabNav } from "@/components/layout";
import { AUTHENTICATED_NAV } from "@/lib/nav-config";

export default function MatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <TabNav items={AUTHENTICATED_NAV} />
      {children}
    </>
  );
}
```

- [ ] **Step 2: Remove the inline navbar from the page**

In `src/app/match/[id]/page.tsx`:
- Delete `import { Navbar } from '@/components/features/navbar'`.
- Replace

```tsx
    <div className="min-h-screen bg-background">
      <Navbar />
      
```

with

```tsx
    <main className="min-h-screen bg-background">
```

and change the matching closing `</div>` at the end of the component's return
(just before `  )\n}`) to `</main>`.

- [ ] **Step 3: Remove the navbar from not-found**

In `src/app/match/[id]/not-found.tsx`, delete the `Navbar` import and the
`<Navbar />` line plus the blank line after it.

- [ ] **Step 4: Remove the navbar placeholder from loading**

In `src/app/match/[id]/loading.tsx`, delete:

```tsx
      {/* Navbar placeholder - will be replaced by real navbar from layout */}
      <div className="h-14 border-b border-card-border bg-card" />
      
```

The layout now stays mounted during loading, so the real navbar shows.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, and no remaining `Navbar` references under `src/app/match/`
(`grep -rn Navbar src/app/match` prints only `layout.tsx`).

- [ ] **Step 6: Verify in the browser**

Run `npm run dev` (port 3001). Open `/match/<any id>` logged in and logged out:
- The navbar **and** the tab row (Home, Matches, …) render once each, not twice.
- The header band is still full width, and the content stays centered at `max-w-4xl`.
- `/match/00000000-0000-0000-0000-000000000000` shows the not-found card with the nav above it.

- [ ] **Step 7: Commit**

```bash
git add src/app/match
git commit -m "fix: render nav tabs on match details via route layout"
```

---

### Task 2: Clickable participants (F5)

**Files:**
- Modify: `src/types/match.ts` (`ParticipantDisplayInfo`, ~line 91)
- Modify: `src/lib/services/match.ts` (~line 346, `participantInfos` map)
- Modify: `src/lib/mock/match.ts` (~line 142, `createMockParticipantDisplayInfo`)
- Move: `src/app/match/[id]/participant-list.tsx` → `src/components/match/participant-list.tsx`
- Modify: `src/app/match/[id]/page.tsx` (import path + pass `username`)
- Test: `src/components/match/participant-list.test.tsx`

**Interfaces:**
- Produces: `ParticipantDisplayInfo.username: string | null` (null for
  placeholders or a missing profile). `ParticipantList` at
  `@/components/match/participant-list` whose `ParticipantInfo` gains
  `username: string | null`. Task 3 edits this same file.

- [ ] **Step 1: Add `username` to the display type**

In `src/types/match.ts`, inside `ParticipantDisplayInfo`, after `name: string`:

```ts
  /** Profile username for linking to /player/[username]; null for placeholders */
  username: string | null
```

- [ ] **Step 2: Populate it in the service and the mock**

`src/lib/services/match.ts`, in the object returned from `participants.map`,
after the `name:` property:

```ts
      username: profileSummary?.username ?? null,
```

`src/lib/mock/match.ts`, in `createMockParticipantDisplayInfo`, after
`name: profile.username,`:

```ts
    username: profile.username,
```

Run: `npx tsc --noEmit`
Expected: PASS. If any other construction site of `ParticipantDisplayInfo`
errors, add `username` there the same way.

- [ ] **Step 3: Move the component**

```bash
git mv "src/app/match/[id]/participant-list.tsx" src/components/match/participant-list.tsx
```

In `src/app/match/[id]/page.tsx`, change
`import { ParticipantList } from './participant-list'` to
`import { ParticipantList } from '@/components/match/participant-list'`.

In the `participants={match.participants.map((p) => ({` object, after `name: p.name,`:

```tsx
                username: p.username,
```

- [ ] **Step 4: Write the failing tests**

Create `src/components/match/participant-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ParticipantList } from "./participant-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/match", () => ({ claimSlotWithAutoApproval: vi.fn() }));
vi.mock("@/components/match/update-deck-modal", () => ({ UpdateDeckModal: () => null }));
vi.mock("@/components/match/post-claim-modal", () => ({ PostClaimModal: () => null }));

type Participant = React.ComponentProps<typeof ParticipantList>["participants"][number];

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "p1",
    name: "Alice",
    username: "alice",
    avatarUrl: null,
    userId: "u1",
    isWinner: false,
    isConfirmed: true,
    ratingDelta: null,
    deck: { id: "d1", commanderName: "Atraxa", deckName: "Superfriends", bracket: 3 },
    ...overrides,
  };
}

function renderList(participants: Participant[], currentUserId: string | null = null) {
  return render(
    <ParticipantList
      participants={participants}
      currentUserId={currentUserId}
      userDecks={[]}
      matchCreatorId="u1"
      matchCreatorUsername="alice"
    />
  );
}

describe("ParticipantList — profile links", () => {
  it("links a registered participant to their public profile", () => {
    renderList([participant()]);
    expect(screen.getByRole("link", { name: /alice/i })).toHaveAttribute("href", "/player/alice");
  });

  it("does not link a placeholder slot, even if its name looks like a username", () => {
    renderList([participant({ id: "p2", userId: null, username: null, name: "bob" })]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("renders plain text when a registered participant has no username", () => {
    renderList([participant({ username: null })]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("keeps action buttons outside the profile link", () => {
    renderList([participant({ isConfirmed: false })], "u1");
    const link = screen.getByRole("link", { name: /alice/i });
    const button = screen.getByRole("button", { name: /update deck/i });
    expect(within(link).queryByRole("button")).not.toBeInTheDocument();
    expect(link.contains(button)).toBe(false);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom src/components/match/participant-list.test.tsx`
Expected: the "links a registered participant" and "keeps action buttons"
tests FAIL (no link rendered). The two negative tests may already pass.

- [ ] **Step 6: Implement the link**

In `src/components/match/participant-list.tsx`:

Add imports:

```tsx
import Link from "next/link";
```

Add to the `ParticipantInfo` type after `name: string;`:

```tsx
  username: string | null;
```

Inside the `participants.map` callback, after `const canClaim = …`:

```tsx
          const profileHref =
            participant.userId && participant.username
              ? `/player/${encodeURIComponent(participant.username)}`
              : null;
```

Replace the avatar + name markup. Everything from `<Avatar` through the closing
`</p>` of the name. Keep the "Open Slot" badge and the deck line as they are.
The current markup is:

```tsx
                <Avatar
                  src={participant.avatarUrl}
                  alt={participant.name}
                  fallback={participant.name}
                  size="lg"
                  className="h-10! w-10! sm:h-14! sm:w-14! shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-1 truncate">{participant.name}</p>
```

Replace it with:

```tsx
                {profileHref ? (
                  <Link href={profileHref} className="shrink-0" aria-hidden tabIndex={-1}>
                    <Avatar
                      src={participant.avatarUrl}
                      alt={participant.name}
                      fallback={participant.name}
                      size="lg"
                      className="h-10! w-10! sm:h-14! sm:w-14! shrink-0"
                    />
                  </Link>
                ) : (
                  <Avatar
                    src={participant.avatarUrl}
                    alt={participant.name}
                    fallback={participant.name}
                    size="lg"
                    className="h-10! w-10! sm:h-14! sm:w-14! shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="font-medium text-text-1 truncate hover:text-accent transition-colors"
                      >
                        {participant.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-text-1 truncate">{participant.name}</p>
                    )}
```

The avatar link is `aria-hidden` with `tabIndex={-1}`, so screen readers and
keyboard users get one link per participant (the name), not two.

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx vitest run --project jsdom src/components/match/participant-list.test.tsx && npx tsc --noEmit && npm run lint`
Expected: 4 tests PASS, no type or lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/match.ts src/lib/services/match.ts src/lib/mock/match.ts src/components/match/participant-list.tsx src/components/match/participant-list.test.tsx "src/app/match/[id]/page.tsx"
git commit -m "feat: link match participants to their player profiles"
```

---

### Task 3: Per-participant bracket badge (CLAUDE.md known issue)

**Files:**
- Modify: `src/components/match/participant-list.tsx`
- Test: `src/components/match/participant-list.test.tsx`
- Modify: `CLAUDE.md` (remove the known issue)

**Interfaces:**
- Consumes: `ParticipantList` and the test helpers `participant()` / `renderList()`
  from Task 2. `BracketBadge` from `@/components/ui` (props `{ bracket: Bracket }`),
  `BRACKET_NAMES` from `@/types` (`1: 'Beginner'`, `2: 'Casual'`,
  `3: 'Upgraded'`, `4: 'cEDH'`), `PLACEHOLDER_DECK_NAME` (`'Unknown Deck'`).

- [ ] **Step 1: Write the failing tests**

Append to `src/components/match/participant-list.test.tsx`:

```tsx
describe("ParticipantList — bracket badge", () => {
  it("shows the deck's bracket name next to the commander", () => {
    renderList([participant()]);
    expect(screen.getByText("Upgraded")).toBeInTheDocument();
  });

  it("hides the badge for the Unknown Deck placeholder", () => {
    renderList([
      participant({ deck: { id: "d0", commanderName: null, deckName: "Unknown Deck", bracket: 2 } }),
    ]);
    expect(screen.queryByText("Casual")).not.toBeInTheDocument();
  });

  it("hides the badge when the bracket is out of range", () => {
    renderList([
      participant({ deck: { id: "d1", commanderName: "Atraxa", deckName: "Superfriends", bracket: 5 } }),
    ]);
    for (const name of ["Beginner", "Casual", "Upgraded", "cEDH"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("renders no badge when the participant has no deck", () => {
    renderList([participant({ deck: null })]);
    expect(screen.queryByText("Upgraded")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom src/components/match/participant-list.test.tsx`
Expected: "shows the deck's bracket name" FAILS. The others may pass already.

- [ ] **Step 3: Implement**

In `src/components/match/participant-list.tsx`:

Add `BracketBadge` to the imports and import the `Bracket` type:

```tsx
import { BracketBadge, RatingDelta } from "@/components/ui";
import type { Bracket, DeckSummary, RatingDelta as RatingDeltaType } from "@/types";
```

(replacing the existing `RatingDelta` import from `@/components/ui` and the
existing `import type { DeckSummary, RatingDelta as RatingDeltaType } from "@/types";`).

Above the component, add:

```tsx
function isBracket(value: number): value is Bracket {
  return value === 1 || value === 2 || value === 3 || value === 4;
}
```

Replace the deck line block:

```tsx
                  {participant.deck && (
                    <p className="text-sm text-text-3 truncate">
                      {participant.deck.commanderName || "Unknown Commander"}
                      {hasPlaceholderDeck && canUpdateDeck && (
                        <span className="text-accent ml-1">(placeholder)</span>
                      )}
                    </p>
                  )}
```

with:

```tsx
                  {participant.deck && (
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm text-text-3 truncate">
                        {participant.deck.commanderName || "Unknown Commander"}
                        {hasPlaceholderDeck && canUpdateDeck && (
                          <span className="text-accent ml-1">(placeholder)</span>
                        )}
                      </p>
                      {!hasPlaceholderDeck && isBracket(participant.deck.bracket) && (
                        <BracketBadge bracket={participant.deck.bracket} className="shrink-0" />
                      )}
                    </div>
                  )}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run --project jsdom src/components/match/participant-list.test.tsx && npx tsc --noEmit && npm run lint`
Expected: 8 tests PASS, no errors.

- [ ] **Step 5: Update CLAUDE.md**

In `CLAUDE.md` under **Known issues**, delete the bullet that starts with
"Match details page missing bracket level visual for individual participant
decks". If that leaves the **Known issues** list empty, replace it with `- None currently tracked.`

- [ ] **Step 6: Verify in the browser**

With `npm run dev`, open a match that has a placeholder slot and a registered player:
- Clicking a registered player's name or avatar goes to `/player/<username>`.
- The placeholder name isn't a link, and "Claim This Slot" still works without navigating.
- Each real deck shows its bracket pill (e.g. "Upgraded"). An Unknown Deck shows none.
- The layout holds at 375px wide (no horizontal scroll; badge doesn't push buttons off-row).

- [ ] **Step 7: Commit**

```bash
git add src/components/match/participant-list.tsx src/components/match/participant-list.test.tsx CLAUDE.md
git commit -m "feat: show per-participant bracket on match details"
```

---

## Self-review notes

- Spec B1 is covered by Task 1. Spec F5 (clickable, placeholders non-clickable)
  is covered by Task 2. The bundled CLAUDE.md known issue is covered by Task 3.
- Out of scope, left to their own plans: the logged-out nav variant (spec B1
  note), Notes → Comments (F1).
