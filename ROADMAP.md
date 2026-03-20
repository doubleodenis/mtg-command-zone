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
> You are here.

- [x] Global layout (nav, sidebar, auth-aware shell)
- [x] Design tokens and Tailwind theme setup (colors, typography, spacing scale)
- [x] Primitive UI components
  - [x] `Button`, `Input`, `Card`, `Badge`, `Avatar`
  - [x] Format indicator (FFA, Pentagram, 1v1, etc.)
  - [x] Bracket indicator (1–4)
  - [x] Rating delta display (`+12`, `−8`)
  - [x] Confirmation status indicator
- [ ] Empty states for every data-dependent view
- [ ] Loading skeletons for every data-dependent view

---

## Phase 3 — Core Pages Against Mock Data

> Build these fully against mock data. This is where missing fields, awkward data shapes, and anything the requirements doc didn't anticipate will surface.

- [ ] Dashboard (dual-purpose — public when logged out, personal when logged in)
  - [ ] **Logged Out — Global Dashboard**
    - [ ] Global leaderboards (top rated players per format)
    - [ ] Recent matches across the platform
    - [ ] Most played commanders/decks
    - [ ] Platform stats (total matches, active players)
    - [ ] Sign up call to action
  - [ ] **Logged In — Personal Dashboard**
    - [ ] Rating view (per-format rating, history chart, recent matches with delta)
    - [ ] Win Rate view (overall + per-format, per-deck, streaks)
    - [ ] Toggle between the two views
    - [ ] Pending confirmation prompts
    - [ ] Pods/collections activity feed
- [ ] Match Log
  - [ ] Full history list
  - [ ] Filters (format, date, deck, result)
  - [ ] Match detail view (participants, decks, rating deltas)
- [ ] Profile Page
  - [ ] Public stats (rating by format, win rates, deck breakdown)
  - [ ] Match history (paginated)
  - [ ] Head-to-head record
- [ ] Deck Manager
  - [ ] Deck list view
  - [ ] Add / edit / retire deck form (including required bracket field)
  - [ ] Per-deck stats (win rate, games played)
- [ ] Collection Dashboard
  - [ ] Collection-scoped rating leaderboard
  - [ ] Activity feed and match history
  - [ ] Per-member win rates

---

## Phase 4 — Supabase Setup

- [ ] Supabase project creation and Auth configuration
- [ ] Write migrations from finalized TypeScript types
- [ ] Row Level Security policies for every table
- [ ] Generate types with Supabase CLI → `types/database.types.ts`
- [ ] Wire generated types to application types
- [ ] Seed script using mock factories

---

## Phase 5 — Data Layer

- [ ] Supabase query helpers in `/lib/supabase` for every domain
  - [ ] Matches
  - [ ] Decks
  - [ ] Collections
  - [ ] Ratings
  - [ ] Profiles / friends
- [ ] Replace mock data in pages with real server-side queries, one page at a time
- [ ] Validate and cast `jsonb` fields (`match_data`, `participant_data`) at the data access boundary — components should never receive untyped json

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

- [ ] Notifications
  - [ ] Match confirmation requests
  - [ ] Participant claim requests
  - [ ] Collection match approval requests
  - [ ] Friend requests
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