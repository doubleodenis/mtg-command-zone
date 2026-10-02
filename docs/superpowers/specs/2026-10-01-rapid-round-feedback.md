# Rapid Round — Small Fixes Backlog

**Date:** 2026-10-01
**Source:** minor findings the final reviews deferred on
`fix/match-details-nav-participants` and `fix/plan-a-display-fixes`, plus
small issues noticed during browser checks. None of them block a merge.
Each item is small (S ≈ under 30 min, M ≈ under 2 h) and independent, so
they can be picked off in any order or batched into one PR.

Line numbers are as of commit `709bcc3`.

| # | Item | Area | Size |
|---|---|---|---|
| R1 | Toast says "Join" under "Added to Collection" | Notifications | S |
| R2 | Refresh can undo an optimistic mark-seen | Notifications | S |
| R3 | Notification arriving while the menu is open stays unseen | Notifications | S |
| R4 | Failed mark-seen isn't rolled back in the dropdown | Notifications | S |
| R5 | Notification limit `10` is duplicated | Notifications | S |
| R6 | `/notifications` mark-seen effect re-runs | Notifications | S |
| R7 | Collection Top Commanders has no empty state | Top Commanders | S |
| R8 | Top Commanders query is unbounded (~1000 rows) | Top Commanders | M |
| R9 | "Waiting on confirmation" also counts recalc-pending matches | Compared to You | S |
| R10 | Footer sits one nav-height below the fold on short match pages | Match Details | S |
| R11 | Match Details header crowds its badges at 375px | Match Details | S |
| R12 | Logged-out visitors see signed-in tabs on public pages | Navigation | M |
| R13 | Some `/player/` links don't encode the username | Links | S |
| R14 | ~~CLAUDE.md says migrations are "001–020"~~ ✅ Done (`033f1c4`) | Docs | S |

---

## Notifications

### R1 — Toast says "Join" under "Added to Collection"
- **Where:** `src/hooks/use-notification-realtime.ts:113-115`
- **Issue:** Plan A changed the `collection_invite` title to "Added to
  Collection", but the realtime toast's description still reads
  `Join "<collection>"`. That implies an action the member doesn't need to
  take.
- **Fix:** change the description to something like
  `You're now in "<collection>"`.

### R2 — Refresh can undo an optimistic mark-seen
- **Where:** `src/components/features/notification-dropdown.tsx:38` (`refresh`)
  and `:60` (`handleOpen`)
- **Issue:** a realtime insert starts `refresh()`. If the user opens the menu
  before it resolves, `handleOpen` marks items seen locally, then the older
  refresh response lands and restores `seenAt: null` and the old count. The
  badge flashes back once. Two refreshes from a burst of inserts can also
  resolve out of order.
- **Fix:** add a request-sequence ref and ignore responses from requests older
  than the latest one, or older than the last `handleOpen`.

### R3 — Notification arriving while the menu is open stays unseen
- **Where:** `notification-dropdown.tsx` (`refresh` while `isOpen`)
- **Issue:** a row that arrives while the menu is open shows up in the list,
  but the badge count goes up while the user is looking right at it.
- **Fix:** when `refresh()` runs with `isOpen === true`, mark the newly fetched
  unseen IDs as seen, the same way `handleOpen` does.

### R4 — Failed mark-seen isn't rolled back in the dropdown
- **Where:** `notification-dropdown.tsx:71`
- **Issue:** the badge and `seenAt` update optimistically, and a failed RPC
  isn't reverted. The failure is reported to Sentry, and the next refresh or
  reload corrects the badge, so the only effect is a badge that's briefly
  wrong.
- **Fix:** if `markNotificationsSeen` returns `success: false`, restore the
  previous count and the `seenAt` values.

### R5 — Notification limit `10` is duplicated
- **Where:** `src/components/features/navbar.tsx:64` and
  `notification-dropdown.tsx:41`
- **Fix:** export a `NOTIFICATION_DROPDOWN_LIMIT = 10` constant and use it in
  both places.

### R6 — `/notifications` mark-seen effect re-runs
- **Where:** `src/components/features/notification-list.tsx:42`
- **Issue:** the effect re-runs whenever `initialNotifications` gets a new
  reference (after a `router.refresh()` from any action), and twice under
  StrictMode in dev. It's harmless, since the RPC is idempotent and refreshed
  rows already have `seenAt` set.
- **Fix (optional):** guard with a ref that holds the IDs already submitted.

## Top Commanders

### R7 — Collection Top Commanders has no empty state
- **Where:** `src/app/collections/[id]/page.tsx:252-257`
- **Issue:** an empty list renders an empty card. The global dashboard shows
  "No commanders played yet." This predates Plan A, but Plan A's
  confirmed/approved filters make an empty list more likely.
- **Fix:** match the dashboard's empty state. Consider copy that names the
  requirement, e.g. "No confirmed games in this collection yet."

### R8 — Top Commanders query is unbounded (~1000 rows)
- **Where:** `src/lib/services/deck.ts:58-76`
- **Issue:** every force-dynamic dashboard load pulls up to PostgREST's
  max-rows (1000) participation rows with embedded decks, including the
  personal dashboard, which then uses only 1. Above the cap, rankings quietly
  cover only the most recent ~1000 participations. The doc comment mentions
  the global scope but not the collection scope, which has the same cap.
- **Fix:** move the aggregation into a SQL RPC (a `GROUP BY` over confirmed
  participations, with an approved-collection filter), and keep
  `rankCommanders` for the ordering. That needs a migration, so it may fit
  better in a later plan than in this round.

## Compared to You

### R9 — "Waiting on confirmation" also counts recalc-pending matches
- **Where:** `src/components/features/player-comparison-card.tsx:284`
- **Issue:** `pendingCount` also counts shared matches that are confirmed but
  still `is_dirty` (waiting on the nightly recalc). The copy only says
  "waiting on confirmation".
- **Fix:** use "waiting on confirmation or recalculation", or split the two
  counts if the data is available.

## Match Details

### R10 — Footer sits one nav-height below the fold on short match pages
- **Where:** `src/app/match/[id]/page.tsx:89`, `loading.tsx:5`, `not-found.tsx:7`
- **Issue:** `min-h-screen` now sits below the layout's Navbar and TabNav, so
  the page is always at least 100vh plus the nav height. The `matches`,
  `decks` and `player` routes don't use `min-h-screen`.
- **Fix:** drop `min-h-screen` from those three files. The root layout's
  `flex-1` wrapper already fills the height.

### R11 — Match Details header crowds its badges at 375px
- **Where:** `src/app/match/[id]/page.tsx` (the header `flex items-center
  justify-between` row)
- **Issue:** at phone width, "Add to Collection", "Pending Recalc" and the
  format badge squeeze beside the wrapped "Match Details" title. Seen during
  the 2026-09-30 browser check; it predates the nav change.
- **Fix:** stack the header on mobile (`flex-col sm:flex-row`) and let the
  badges wrap.

## Navigation & Links

### R12 — Logged-out visitors see signed-in tabs on public pages
- **Where:** `src/app/match/layout.tsx`, `src/app/player/layout.tsx`
- **Issue:** both always render `AUTHENTICATED_NAV`, so a logged-out visitor
  sees Matches/Decks/Collections tabs that redirect to login. The spec (B1
  note) deferred this.
- **Fix:** pick the nav items by session (a logged-out variant: Home,
  Leaderboards, FAQ). Decide the exact items first.

### R13 — Some `/player/` links don't encode the username
- **Where:** `src/app/collections/[id]/members/page.tsx:43,53`,
  `src/app/collections/[id]/page.tsx:292`. Also check `friends/page.tsx`,
  `friends/friend-search.tsx`, `friend-dropdown/friends-tab.tsx` and
  `friend-dropdown/requests-tab.tsx`.
- **Issue:** they interpolate `username` raw. The match participant list uses
  `encodeURIComponent`. It only matters if usernames can hold URL-reserved
  characters.
- **Fix:** add a `playerHref(username)` helper in `src/lib/utils.ts` and use
  it everywhere, or confirm the username rules make it unnecessary.

## Docs

### R14 — CLAUDE.md says migrations are "001–020"
**Status:** ✅ Done — fixed in `033f1c4` (CLAUDE.md now says "001–031").
- **Where:** `CLAUDE.md:91`
- **Fix:** update it to "001–029", or drop the range so it doesn't go stale
  again.
