# Format Trim & Player-Slot Redesign

**Date:** 2026-08-19
**Status:** Approved

## Context

CommandZone was built for a specific playgroup and currently supports five formats: 1v1, 2v2, 3v3, FFA, and Pentagram. To better fit the more traditional ways Commander is played across the wider community, 2v2 and 3v3 are being temporarily removed from the app. Separately, the player-selection UI on the "log match" page has grown cluttered — each player slot crams a search/guest picker, avatar, name, commander search, and deck selector into a single dense card — and needs a cleaner visual structure.

## Goals

1. Remove 2v2 and 3v3 as selectable formats, reversibly, without breaking historical matches logged under those formats.
2. Redesign the player-slot card (used on the log-match page for FFA, 1v1, and Pentagram) into a clearer two-zone layout.

## Non-Goals

- No change to the rating algorithm, match data schema, or `FormatConfig`/`MatchData`/`ParticipantData` types.
- No removal of 2v2/3v3 code, types, or historical data — this is a visibility/availability change only.
- No new overlay/modal component for player selection (ruled out in favor of restructuring the existing card).
- No change to team-format logic beyond what naturally falls out of 2v2/3v3 no longer being selectable (1v1 remains the only team format in the active set).

## Section 1: Removing 2v2/3v3

Formats are already data-driven: the `formats` table has an `is_active` column, and `getFormats` / `getFormatSummaries` (`src/lib/supabase/formats.ts`) already filter on `is_active = true`. The match-logging form (`MatchForm` in `src/components/match/match-form.tsx`) only ever renders formats passed in from that query, so deactivating rows is sufficient to remove them from selection everywhere formats are chosen (new match form, leaderboard/collection filters).

**Change:**
- New migration `supabase/migrations/021_deactivate_team_formats.sql`:
  ```sql
  UPDATE formats SET is_active = false WHERE slug IN ('2v2', '3v3');
  ```
- No application code changes required.

**Behavior preserved:**
- Historical 2v2/3v3 matches remain fully viewable — match detail and history pages resolve a match's format by ID (`getFormatById`), not through the active-formats list, so past matches render correctly regardless of `is_active`.
- Reactivation is a one-line follow-up migration (`is_active = true`) whenever 2v2/3v3 come back.

## Section 2: Player-Slot Visual Redesign

Applies to both `PlayerSlot` (`src/components/match/player-slot.tsx`, used by FFA and 1v1 layouts) and `PentagonPlayerCard` (used by the Pentagram star layout in `src/components/match/pentagram-layout.tsx`), for visual consistency across all three active formats.

**Structure — "two-step card":**

- **Filled state** — a single card split by a horizontal divider into two zones:
  - **Header row**: avatar, player name/username (registered) or an editable guest-name input (placeholder), plus action icons — winner-toggle (trophy) and remove (✕). These action icons move from today's separate bottom-right stack into the header row itself.
  - **Details section** (below the divider): deck picker for registered players, or commander search for guest players. Both player types use the same field position, so the two flows read the same way once a slot is filled.
- **Empty state**: unchanged content — search input, "Add yourself" shortcut, "Add as Guest" option, friends list, and search results in a dropdown — just rendered inside the visually tightened card. No new modal/overlay component.
- **Guest flow**: choosing "Add as Guest" transitions the slot directly into the filled state, with the guest-name input in the header (editable in place) and commander search available below the divider.
- **Pentagram adaptation**: `PentagonPlayerCard` gets the same header/divider/details structure, scaled to fit the star layout's smaller per-card footprint.

**Interfaces:** No changes to `PlayerSlotProps`, `PentagonPlayerCardProps`, or `ParticipantSlot` (`src/components/match/match-form-types.ts`). This is a JSX/styling restructuring, not a data or behavior change. The 1v1 team layout continues to work unchanged since it already sets `hideWinnerButton` and the header row still renders the remove icon regardless of team format.

**Testing:** No new logic to unit test. Verification is manual/visual — run the dev server and exercise the log-match form for FFA, 1v1, and Pentagram: add/remove players, the guest flow (name + optional commander), deck selection for registered players, and the winner toggle, confirming no regressions from the current behavior.

## Open Questions

None outstanding — both sections were reviewed and approved.
