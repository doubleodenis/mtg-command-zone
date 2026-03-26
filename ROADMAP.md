# MTG Commander Tracker — Project Roadmap

> Build order following a UI-first approach. Each phase builds on what's already stable before moving to the next layer. **Complete Phase 3 before touching Supabase** — the mock phase is where the schema gets battle-tested before it costs you a migration.

---

## Phase 1 — Foundation
> Complete!

- [x] TypeScript types for all data models (`/types`)
- [x] `RATING_CONFIG` constant and rating algorithm as pure functions (`/lib/rating`)
- [x] Mock data factories for every major type (`/lib/mock`)

---

## Phase 2 — UI Shell
> Complete!

- [x] Global layout (nav, sidebar, auth-aware shell)
- [x] Design tokens and Tailwind theme setup (colors, typography, spacing scale)
- [x] Primitive UI components
  - [x] `Button`, `Input`, `Card`, `Badge`, `Avatar`
  - [x] Format indicator (FFA, Pentagram, 1v1, etc.)
  - [x] Bracket indicator (1–4)
  - [x] Rating delta display (`+12`, `−8`)
  - [x] Confirmation status indicator
- [x] Empty states for every data-dependent view
- [x] Loading skeletons for every data-dependent view
- [x] Error boundaries for graceful error handling

---

## Phase 3 — Core Pages Against Mock Data
> Complete (except match detail)!

- [x] Dashboard (dual-purpose — public when logged out, personal when logged in)
  - [x] **Logged Out — Global Dashboard**
    - [x] Global leaderboards (top rated players per format)
    - [x] Recent matches across the platform
    - [x] Most played commanders/decks
    - [x] Platform stats (total matches, active players)
    - [x] Sign up call to action
  - [x] **Logged In — Personal Dashboard**
    - [x] Stats visualization (rating, win rate, matches, streak)
    - [x] Rating history chart
    - [x] Pending confirmation prompts
    - [x] Recent matches with rating deltas
    - [x] Pods/collections activity
  - [x] **Match Preview Card** (format-aware display)
    - [x] Team formats with VS divider (1v1, 2v2, 3v3)
    - [x] FFA format (all participants in row)
    - [x] Pentagram format with ally/enemy indicators
- [ ] Match Log
  - [x] Full history list with date grouping
  - [x] Filters (format, result)
  - [ ] Match detail view (participants, decks, rating deltas)
- [x] Profile Page
  - [x] Public stats (rating by format, win rates, deck breakdown)
  - [x] Match history with filters
  - [x] Head-to-head comparison (when viewing another player's profile)
    - [x] Win rate as enemies  
    - [x] Win rate as teammates
    - [x] Per-format record against them
    - [x] Best commander vs their decks
- [x] Deck Manager
  - [x] Deck list view (active/retired sections with card grid)
  - [x] Add / edit / retire deck form (commander picker, bracket selector, locked when used in matches)
  - [x] Per-deck stats (win rate, games played, W/L record)
- [x] Collection Dashboard
  - [x] Collection-scoped rating leaderboard
  - [x] Activity feed and match history
  - [x] Per-member win rates

---

## Phase 4 — Supabase Setup
> Complete!

- [x] Supabase project creation and Auth configuration
- [x] Write migrations from finalized TypeScript types
  - [x] `001_initial_schema.sql` — Core tables (profiles, friends, decks, formats, matches, match_participants, collections, collection_members, collection_matches, ratings, rating_history)
  - [x] `002_schema_additions.sql` — Notifications system with fan-out on write, TTL cleanup, Realtime subscription
- [x] Row Level Security policies for every table
- [x] Database functions (get_or_create_rating, get_user_stats, get_leaderboard, get_deck_stats)
- [x] Notification triggers (match confirmation, friend request, claim request, collection invite)
- [x] Run migrations against hosted Supabase (paste in SQL Editor or use CLI)
- [x] Generate types with Supabase CLI → `types/database.types.ts`
- [x] Wire generated types to application types
  - [x] `types/database-mappers.ts` — snake_case → camelCase conversion
  - [x] `types/notification.ts` — Notification type definitions
  - [x] Updated `types/index.ts` exports
- [x] Seed script using mock factories → `scripts/seed.ts`

---

## Phase 5 — Data Layer
> You are here.

- [x] Supabase query helpers in `/lib/supabase` for every domain
  - [x] Profiles / friends
  - [x] Decks
  - [x] Collections
  - [x] Matches
  - [x] Ratings
  - [x] Formats
  - [x] Dashboard (combined queries for platform stats, match cards, etc.)
- [x] Validate and cast `jsonb` fields (`match_data`, `participant_data`) at the data access boundary — components should never receive untyped json
- [ ] Replace mock data in pages with real server-side queries, one page at a time
  - [x] Dashboard (global + personal)
  - [ ] Decks page
  - [ ] Collections page
  - [ ] Player profile page
  - [ ] Match detail page

---

## Phase 6 — Core Features

- [ ] Auth flow (sign up, login, session handling, protected routes)
- [ ] Match creation flow
  - [ ] Format selection
  - [ ] Participant selection (friends, placeholders)
  - [ ] Deck assignment per participant (including placeholder deck fallback)
  - [ ] Winner / winning team recording
- [ ] Match confirmation (notification → confirm action → rating trigger)
- [ ] Deck manager CRUD (create, edit, retire)

---

## Phase 7 — Social & Collections

- [ ] Friend system (send request, accept, block)
- [ ] Quick-add friends when logging a match
- [ ] Collection creation and settings
  - [ ] Name, description, visibility toggle
  - [ ] Match add permission (`owner_only`, `any_member`, `any_member_approval_required`)
- [ ] Add match to collection flow
- [ ] Collection match approval flow (for `any_member_approval_required`)
- [ ] Collection member management (invite, remove)
- [ ] Collection-scoped rating and leaderboard

---

## Phase 8 — Rating System

- [ ] Wire rating calculation to match confirmation event
- [ ] Global rating update on confirmation
- [ ] Collection-scoped rating update on confirmation (all collections the match belongs to)
- [ ] Rating history logging with all snapshot fields (`player_bracket`, `opponent_avg_rating`, `opponent_avg_bracket`, `k_factor`, `algorithm_version`)
- [ ] Rating recalculation as a Supabase Edge Function
  - [ ] Reset all ratings to default
  - [ ] Replay confirmed matches in chronological order
  - [ ] Stamp new `algorithm_version` on rewritten history rows
  - [ ] Admin panel status indicator for recalculation progress

---

## Phase 9 — Placeholder & Claim Systems

- [ ] Placeholder participant creation in match flow
- [ ] Placeholder deck assignment and fallback (bracket defaults to 2)
- [ ] Claim request submission (search for matches by placeholder name)
- [ ] Owner notification and approve / reject flow
- [ ] Rating trigger on claim approval + confirmation
- [ ] Placeholder deck retroactive update flow (any linked participant can update their slot)

---

## Phase 10 — Polish & Edge Cases

- [ ] Notifications UI
  - [x] Schema designed with fan-out on write, TTL cleanup, seen/read/dismissed states
  - [x] Notification types defined (match_pending_confirmation, match_confirmed, elo_milestone, friend_request, claim_available, collection_invite, etc.)
  - [x] Database triggers for auto-creating notifications
  - [x] Realtime subscription enabled
  - [ ] Notification dropdown component
  - [ ] Notification center page
  - [ ] Toast notifications for real-time updates
- [ ] Supabase Realtime for notification count and match confirmation status
- [ ] Optimistic updates for key actions (match confirm, add to collection)
- [ ] Error boundaries and user-friendly error messages throughout
- [ ] Full empty state and loading state audit
- [ ] Mobile layout pass — verify every view on small screens

---

## Phase 11 — Future Considerations

- [ ] Scryfall API integration for commander autocomplete and color identity
- [ ] Global leaderboards (per format, public and friends-only)
- [ ] Match disputes (flag incorrect results)
- [ ] Deck archetypes and power level tags (e.g. CEDH, Casual, 1–10 scale)
- [ ] Tournaments (bracket or round-robin events within a collection)
- [ ] Mobile app (React Native or PWA)