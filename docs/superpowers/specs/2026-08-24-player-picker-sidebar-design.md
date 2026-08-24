# Player Picker Sidebar — Design

**Date:** 2026-08-24
**Branch:** `player-picker-sidebar`
**Status:** Approved

## Motivation

The log-match page's current player-selection UX is a per-slot inline
search dropdown (`PlayerSlot`, `PentagonPlayerCard`): each empty slot has
its own "search players or add guest" box that queries a `profiles`
table filter. This works but doesn't scale well conceptually to matches
with friends/collection-mates you play with repeatedly, and it offers no
way to reorder seated players — which matters for team formats (which
team someone lands on) and especially Pentagram (seat position determines
ally/enemy).

This design adds a **persistent sidebar player-picker** with drag-and-drop,
scoped to whichever collection(s) the match is being logged into (if any).

## Goals

- Faster player selection for recurring playgroups: browse Friends or a
  selected Collection's members in a sidebar instead of typing a search
  query per slot.
- Drag-and-drop from sidebar → slot, and slot → slot for reordering
  (team assignment / pentagon seating).
- Click-to-add as a first-class, non-drag alternative (accessibility +
  touch-friendly).
- Preserve all existing capability: guest/placeholder players, deck
  selection, winner toggling, format-specific layouts (FFA flat list,
  team VS columns, Pentagram pentagon).

## Non-goals

- Dragging decks/commanders (Collection tab is members-only, no deck
  picking from the sidebar).
- A global "search any player" box in the sidebar — that stays as the
  per-slot inline search fallback for finding someone outside your
  friends/collection.
- Persisting or recalling previously-used guest names. Guests are always
  typed fresh.

## Architecture

### New component: `PlayerSidebar`

`src/components/match/player-sidebar.tsx` — client component rendered by
`MatchForm` alongside the Players card, in a responsive two-column layout:

```
md:grid md:grid-cols-[1fr_280px] gap-4
```

Below `md`, the sidebar renders as a full-width block stacked *above* the
player list (a permanently-docked side column doesn't work on narrow
viewports).

**Tabs:** `Friends` | `Collection`. The Collection tab is disabled
(visually present but non-interactive, with a tooltip/hint) unless at
least one collection is selected in the "Add to Collections" section.
Because the sidebar depends on collection selection, the **Match
Details card's "Add to Collections" block moves above the Players card**
in the form's render order (currently it's below, in Match Details).

If multiple collections are selected, the Collection tab shows the
**union of all selected collections' members, deduplicated by user id** —
no nested per-collection sub-picker.

**Search:** one filter input at the top of the sidebar, scoped to the
active tab's already-loaded list (client-side substring filter on
username/display name) — not a new server search endpoint. Finding
someone outside friends/collection still goes through the existing
per-slot inline search (unchanged).

**Row rendering:** avatar, display name, @username, filtered against
`excludeIds` (people already seated) same as the current per-slot
dropdown does.

### Data fetching

`MatchForm` gains two new pieces of state:
- `friends: SearchResult[]` — fetched once via the existing `getFriends`
  helper (`src/lib/supabase/profiles.ts`) when the sidebar mounts.
- `collectionMembers: Record<collectionId, CollectionMemberWithProfile[]>`
  — fetched via the existing `getCollectionWithMembers` helper
  (`src/lib/supabase/collections.ts`) whenever `selectedCollectionIds`
  changes and a given id isn't already cached.

Both fetches happen once per mount/selection-change, not on every tab
switch — sidebar tab switching only toggles which cached list renders.

### Drag-and-drop: `@dnd-kit/core`

New dependency (`@dnd-kit/core`, `@dnd-kit/utilities`). Chosen over native
HTML5 drag events for built-in pointer + touch + keyboard support and
accessible announcements — native HTML5 DnD has poor mobile touch support
and no keyboard path, which would leave click-to-add as the only
non-desktop option.

- `MatchForm`'s participants area is wrapped in a single `DndContext`.
- Each `PlayerSidebar` row is `useDraggable`, id = the source player's
  user id (prefixed, e.g. `sidebar:{userId}`).
- Each `PlayerSlot` / `PentagonPlayerCard` (both empty and filled) is
  `useDroppable`, id = the slot's index (e.g. `slot:{index}`).
- `onDragEnd` in `MatchForm` dispatches to one of the existing mutation
  functions (`addRegisteredPlayerAt`, a new `movePlayer`, or a new
  `shiftInsertPlayerAt`) based on the drag source/target id prefixes and
  current slot occupancy — see **Drop semantics** below.
- Keyboard sensor (`@dnd-kit`'s `KeyboardSensor`) is enabled alongside
  `PointerSensor`, giving Space-to-pick-up / arrow-to-move / Space-to-drop
  as a built-in accessible path.

## Drop semantics

| Source | Target | Result |
|---|---|---|
| Sidebar row (click) | — | Adds to first empty slot; no-op + inline message if roster is full |
| Sidebar row (drag) | Empty slot | Fills that slot directly |
| Sidebar row (drag) | Filled slot, **FFA or same team column has another empty slot** | **Shift-insert**: dropped player takes the target slot; existing occupants shift by one toward the nearest empty gap within that same scope (flat list for FFA, same team column for 1v1/2v2/3v3) |
| Sidebar row (drag) | Filled slot, **no empty slot in scope** | **Replace**: dropped player takes the slot; previous occupant is removed from the match entirely |
| Sidebar row (drag) | Filled **Pentagram** seat | Always **replace**, never shift-insert — seat position determines ally/enemy, so other seated players must never move as a side effect of someone else's drop. A short inline note near the pentagon states "Drop replaces the seated player." |
| Already-seated player (drag) | Any other slot | **Move** (not insert) — the two slots' contents swap if the target was filled, or the player simply relocates if the target was empty. Team/seat membership recomputes from the new index via the existing `getTeamForIndex` logic. Unrestricted: any slot can be dragged to any other slot, including across the team divider or around the pentagon. |

Shift-insert and move both operate purely on the `participants` array by
index — no new identity/keying scheme is needed, since index already
fully determines team/seat meaning today (`getTeamForIndex`).

**Known UX risk, called out for visibility, not for a design change:**
because Pentagram reordering is unrestricted, a seated player's ally/enemy
label can change purely from a drag *elsewhere* in the pentagon (not their
own slot). The implementation should include a brief transition/highlight
on adjacency changes so this reads as intentional feedback, not a glitch.

## What stays unchanged

- Per-slot inline search (`PlayerSlot`'s empty-state dropdown) remains
  functional as a fallback for finding a player outside friends/current
  collection selection, and as the only path for adding guests (typed
  fresh, no recall of past guest names).
- Deck selection, winner toggling, guest commander search — untouched.
- `buildMatchData`, `validateForm`, `handleSubmit` — untouched; they
  operate on the same `participants` array shape regardless of how it was
  populated (click, drag, or inline search).

## Testing

This branch is almost entirely interactive/visual (drag-and-drop, sidebar
rendering, tab switching) with no new business-logic functions worth unit
testing beyond what already exists. Verification will be manual/e2e:
sidebar population (friends, collection members, dedup across multiple
selected collections), click-to-add, drag-to-empty, drag-to-filled
(shift-insert and replace paths), Pentagram replace-only behavior,
already-seated reorder across FFA/team/Pentagram, keyboard DnD path, and
mobile stacked-layout fallback — across all three active formats
(1v1, FFA, Pentagram).
