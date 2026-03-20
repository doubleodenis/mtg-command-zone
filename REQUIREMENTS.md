# MTG Commander Tracker — Project Requirements

> A competitive stat-tracking and Rating system for Magic: The Gathering's Commander format and its variants. Inspired by platforms like Leetify and Statlocker.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (React 19, TypeScript) |
| Styling | Tailwind CSS 4 |
| Backend / Database | Supabase |

---

## 1. Application Routes

### Route Structure

| Route | Auth | Description |
|---|---|---|
| **Public** | | |
| `/` | — | Dashboard (global view logged out, personal view logged in) |
| `/login` | — | Login / sign up |
| `/leaderboards` | — | Global leaderboards overview |
| `/leaderboards/[format]` | — | Format-specific leaderboard |
| `/player/[username]` | — | Public player profile |
| `/player/[username]/matches` | — | Player's match history |
| `/player/[username]/decks` | — | Player's public decks |
| `/match/[id]` | — | Match detail view |
| `/collections/[id]` | — | Public collection view (if `is_public = true`) |
| `/collections/[id]/leaderboard` | — | Collection leaderboard |
| **Auth Required** | | |
| `/matches` | ✓ | Personal match history |
| `/matches/new` | ✓ | Log a new match |
| `/decks` | ✓ | Deck manager (my decks) |
| `/decks/new` | ✓ | Add a new deck |
| `/decks/[id]` | ✓ | Deck detail view |
| `/decks/[id]/edit` | ✓ | Edit deck |
| `/collections` | ✓ | My collections list |
| `/collections/new` | ✓ | Create a new collection |
| `/collections/[id]/matches` | ✓ | Collection match history (members only if private) |
| `/collections/[id]/settings` | ✓ | Collection settings (owner only) |
| `/collections/[id]/members` | ✓ | Member management (owner only) |
| `/friends` | ✓ | Friends list and requests |
| `/notifications` | ✓ | Notification center |
| `/settings` | ✓ | User settings overview |
| `/settings/profile` | ✓ | Edit profile (username, avatar, bio) |
| `/settings/account` | ✓ | Account settings (email, password, delete) |

### Route Behaviors

**Home (`/`)** is the dashboard and adapts based on auth state:
- **Logged out**: Shows global leaderboards, recent platform matches, top commanders, platform stats, sign-up CTA — gives visitors a reason to explore and social proof the platform is active
- **Logged in**: Shows personal ratings, pending confirmations, recent matches, collections activity, quick actions

**Player Profile (`/player/[username]`)** is always public — ratings, win rates, and match history are visible to all. The profile owner sees additional editing options.

**Collections (`/collections/[id]`)** respect the `is_public` flag:
- Public collections are viewable by anyone
- Private collections return 404 for non-members
- Settings and member management are owner-only

**Match Detail (`/match/[id]`)** is public — participants, decks, results, and rating deltas are visible. Participants see confirmation actions.

---

## 2. Formats

The system is designed to be **format-agnostic and extensible** — new formats can be added without restructuring the core data model.

### Supported Formats

| Format | Players | Teams | Win Condition |
|---|---|---|---|
| **1v1** | 2 | Yes (1v1) | Eliminate the opposing player |
| **2v2** | 4 | Yes (2v2) | Eliminate all players on the opposing team |
| **3v3** | 6 | Yes (3v3) | Eliminate all players on the opposing team |
| **FFA** (Free For All) | 3+ (typically 4) | No | Last player standing |
| **Pentagram** | 5 | Special (see below) | Defeat your two non-adjacent opponents |

### Pentagram Format — Special Rules

In Pentagram, players are seated in a 5-point star arrangement. Each player's two **adjacent** players are considered **allies** — they do not need to be eliminated to win. A player wins by eliminating only their **two non-adjacent** opponents.

```
          [Player 1]
         /           \
   [Player 5]     [Player 2]
        |               |
   [Player 4]     [Player 3]

Player 1's enemies: Player 3, Player 4
Player 1's allies:  Player 2, Player 5
```

### Format Extensibility

When adding a new format, the following must be defined:

- `min_players` / `max_players`
- `has_teams` (boolean)
- `win_condition_type` (e.g., `last_standing`, `eliminate_team`, `eliminate_targets`)
- Any special positional/relationship rules (e.g., Pentagram adjacency), stored in `config` jsonb

---

## 3. Data Models (Conceptual)

### `users`
Standard authentication record (managed by Supabase Auth).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `email` | string | Unique |
| `created_at` | timestamp | |

---

### `profiles`
Extended user information and public-facing identity.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | FK → users.id |
| `username` | string | Unique display name |
| `avatar_url` | string | Optional |
| `created_at` | timestamp | |

---

### `friends`
Bidirectional friendship system.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `requester_id` | uuid | FK → users.id |
| `addressee_id` | uuid | FK → users.id |
| `status` | enum | `pending`, `accepted`, `blocked` |
| `created_at` | timestamp | |

---

### `decks`
Each user maintains a list of their commanders/decks.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid | FK → users.id |
| `commander_name` | string | Primary commander |
| `partner_name` | string | Optional (partner commanders) |
| `deck_name` | string | Optional friendly name |
| `color_identity` | string[] | e.g., `['W','U','B']` |
| `bracket` | int | Required. MTG bracket 1–4. Used in rating calculations. |
| `is_active` | boolean | Hide retired decks |
| `created_at` | timestamp | |

> **Placeholder Deck:** A sentinel record (e.g., `deck_name = "Unknown Deck"`) is used when the commander played is not known at match creation time. Any linked participant can retroactively update their slot to the correct deck once it's added to their list.

---

### `formats`
Lookup table for game formats — config-driven for extensibility.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | e.g., `"FFA"`, `"Pentagram"` |
| `slug` | string | e.g., `"ffa"`, `"pentagram"` |
| `min_players` | int | |
| `max_players` | int | `null` = no upper limit |
| `has_teams` | boolean | |
| `win_condition_type` | enum | `last_standing`, `eliminate_team`, `eliminate_targets` |
| `config` | jsonb | Format-specific rules and the expected shape of `match_data` and `participant_data` for that format (e.g. Pentagram adjacency logic, Emperor role definitions) |
| `is_active` | boolean | Toggle formats on/off |

---

### `matches`
The core match record.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `created_by` | uuid | FK → users.id (match reporter) |
| `format_id` | uuid | FK → formats.id |
| `played_at` | timestamp | When the match was played |
| `notes` | string | Optional |
| `match_data` | jsonb | Format-specific match-level metadata (e.g. Emperor king assignments per team). Schema defined per format in `formats.config`. |
| `created_at` | timestamp | |

---

### `match_participants`
One row per player slot in a match. Handles registered users and placeholder guests.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `match_id` | uuid | FK → matches.id |
| `user_id` | uuid | FK → users.id — `null` if placeholder |
| `placeholder_name` | string | Used when `user_id` is null |
| `deck_id` | uuid | FK → decks.id — can reference placeholder deck |
| `team` | string | Team identifier — null for FFA/Pentagram |
| `is_winner` | boolean | Whether this participant won |
| `confirmed_at` | timestamp | When this participant confirmed — null = unconfirmed. Reporter auto-confirmed on creation. |
| `claimed_by` | uuid | FK → users.id — user requesting to claim this placeholder slot |
| `claim_status` | enum | `none`, `pending`, `approved`, `rejected` |
| `participant_data` | jsonb | Format-specific participant-level metadata (e.g. Pentagram target IDs, Emperor role). Schema defined per format in `formats.config`. |
| `created_at` | timestamp | |

---

### `collections`
Named groups of matches. Can represent a pod, tournament, game night, season, or anything. A match can belong to any number of collections.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `owner_id` | uuid | FK → users.id |
| `name` | string | e.g., `"Friday Pod"`, `"Summer Tournament 2025"` |
| `description` | string | Optional |
| `is_public` | boolean | Whether non-members can view the collection |
| `match_add_permission` | enum | `owner_only`, `any_member`, `any_member_approval_required` |
| `created_at` | timestamp | |

---

### `collection_members`
Users who are members of a collection.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `collection_id` | uuid | FK → collections.id |
| `user_id` | uuid | FK → users.id |
| `role` | enum | `owner`, `member` |
| `joined_at` | timestamp | |

---

### `collection_matches`
Many-to-many join between collections and matches.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `collection_id` | uuid | FK → collections.id |
| `match_id` | uuid | FK → matches.id |
| `added_by` | uuid | FK → users.id |
| `approval_status` | enum | `approved`, `pending`, `rejected` — always `approved` unless permission is `any_member_approval_required` |
| `added_at` | timestamp | |

---

### `ratings`
Current rating per player, per format. A parallel record scoped to a collection exists for collection ratings. `collection_id = null` denotes the global rating.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → users.id |
| `format_id` | uuid | FK → formats.id |
| `collection_id` | uuid | FK → collections.id — `null` for global rating |
| `rating` | int | Current rating (default: 1000) |
| `matches_played` | int | Confirmed matches counted toward this rating |
| `updated_at` | timestamp | |

---

### `rating_history`
Immutable append-only log of every rating change, for audit trail and charting. Stores all inputs to the algorithm as snapshots so ratings can be recalculated retroactively without re-deriving inputs.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → users.id |
| `match_id` | uuid | FK → matches.id |
| `format_id` | uuid | FK → formats.id |
| `collection_id` | uuid | FK → collections.id — `null` for global changes |
| `rating_before` | int | Player's rating before this match |
| `rating_after` | int | Player's rating after this match |
| `delta` | int | Change (positive or negative) |
| `player_bracket` | int | Bracket of the deck played — snapshotted at confirmation time |
| `opponent_avg_rating` | float | Average rating of opponents at match time |
| `opponent_avg_bracket` | float | Average bracket of opponents at match time |
| `k_factor` | int | K value used for this calculation (32, 24, or 16) |
| `algorithm_version` | int | Version of the rating algorithm used — enables audit trail across formula changes |
| `created_at` | timestamp | Timestamp of confirmation, not match date |

---

## 4. Key System Behaviors

### 3.1 Match Creation Flow

1. The **match reporter** (a logged-in user) initiates match creation.
2. They select the **format**.
3. They add **participants** — each can be a linked friend (via `user_id`) or a guest/placeholder (name only, `user_id = null`).
4. For each participant, the reporter selects the **deck/commander** used, or assigns the "Unknown Deck" placeholder if unknown.
5. They record the **winner** (or winning team). Win/loss is the only required outcome — no placement tracking beyond that.
6. Match is saved. The reporter's slot is **auto-confirmed**. All other linked participants receive a notification to confirm.

---

### 3.2 Rating Confirmation Model

- **A player's rating only updates when they personally confirm a match.** The reporter is auto-confirmed on creation; all other linked participants confirm separately.
- A match can be in a **partially-confirmed state** — some participants have updated ratings, others are still pending.
- Rating deltas are calculated against each player's rating **snapshotted at the time the match was played**, not at confirmation time — preventing inflation or deflation from delayed confirmations.
- When a placeholder slot is claimed and approved, the claiming user can then confirm, triggering their rating update as if they were a normal participant.

---

### 3.3 Rating Algorithm

The system uses an **Expected Score Model** — a single consistent calculation that works across all formats and table sizes, including asymmetric formats like Pentagram. This is preferred over pairwise (Multiway ELO) because Pentagram's ally/enemy structure makes pairwise comparisons semantically misleading, and a single model is easier to maintain across 2-player through 6-player formats.

**Formula:**

```
Δ Rating = K × (Actual − Expected) × BracketModifier
```

**Actual** — `1` if the player won, `0` if they lost.

**Expected Score** — the player's probability of winning given the ratings at the table:

```
Expected = player_rating_factor / sum(all_player_rating_factors)
where rating_factor = 10 ^ (rating / 400)
```

This is the standard logistic curve used in ELO, extended to N players. A player rated significantly higher than the table will have a high expected score; winning gains them little, losing costs them more.

**K Factor** — controls how much a single match can move a player's rating. Decreases as a player accumulates confirmed matches, stabilizing experienced players' ratings:

| Confirmed Matches | K Value |
|---|---|
| 0 – 20 | 32 (calibration phase — rating moves fast) |
| 21 – 50 | 24 |
| 51+ | 16 (veteran — rating is stable) |

**Bracket Modifier** — adjusts the delta based on the bracket differential between the player's deck and the average bracket of opponents' decks. The modifier uses a **`|gap|^1.5` curve** — non-linear enough to reflect the real power jumps between brackets (especially 2→3 and 3→4), but without the extreme ceiling of a pure square:

```
gap = avg_opponent_bracket − player_bracket
BracketModifier = 1 + sign(gap) × |gap|^1.5 × 0.12
```

| Bracket Gap | Win Modifier | Loss Modifier |
|---|---|---|
| ±1 bracket | ×1.12 | ×0.88 |
| ±2 brackets | ×1.34 | ×0.66 |
| ±3 brackets (e.g. bracket 1 vs bracket 4 table) | ×1.62 | ×0.38 |

A bracket 1 deck winning against a bracket 4 table is treated as a meaningful upset. A bracket 4 deck losing to a bracket 1 table incurs a real penalty — the power advantage was not converted.

The `0.12` coefficient and `1.5` exponent are tunable constants stored in backend config, not hardcoded.

If a deck has no bracket set, it is treated as **bracket 2** for this calculation.

**Pentagram bracket modifier note:** All 5 players' brackets are averaged for the modifier — including adjacent non-targets. Although adjacent players share your win condition direction, a high-bracket adjacent player can accelerate the game and eliminate their own targets faster, directly affecting whether you get to execute your win condition. Both the expected score calculation and the bracket modifier therefore use all 5 players.

**Raw win rate is intentionally excluded** from the rating formula — it is already implicitly captured by a player's rating over time, and adding it directly would cause double-counting. Win rate is displayed prominently as a separate stat on the dashboard.

---

### 3.3 Rating Scope — Global vs. Collection

Players have two parallel rating tracks:

- **Global Rating** — scoped to a format, across all confirmed matches. One rating per format per player.
- **Collection Rating** — scoped to both a format and a specific collection. Only matches belonging to that collection count. One rating per format per collection per player.

When a player confirms a match, both tracks update simultaneously — the global rating and the rating for every collection that match belongs to. A match in 3 collections triggers 4 rating updates (1 global + 3 collection-scoped) per confirming player.

---

### 3.7 Retroactive Rating Recalculation

Because `rating_history` stores all algorithm inputs as snapshots (brackets, opponent ratings, K factor), the rating formula can be changed and all historical ratings recalculated without losing any data.

**Recalculation process:**
1. Reset all `ratings` rows to the default (1000)
2. Replay every confirmed match in chronological order (`played_at`), applying the new formula
3. Rewrite `rating_history` with new deltas, stamped with the new `algorithm_version`

**Partial recalculation** is also possible — if only a coefficient changes (e.g., tuning `0.12`), matches before a cutoff date can be grandfathered and only newer matches recalculated.

**Algorithm versioning** — `algorithm_version` on `rating_history` provides a full audit trail of when the formula changed. Old and new ratings can be compared before committing a recalculation.

**Implementation note:** Recalculation over large match histories is a background job (Supabase Edge Function or queued worker), not a synchronous API call. An admin panel status indicator should reflect when a recalculation is in progress or completed.

---

Set by the collection owner on creation; can be updated at any time in collection settings:

| Permission | Behavior |
|---|---|
| `owner_only` | Only the collection owner can add matches |
| `any_member` | Any member can add matches freely |
| `any_member_approval_required` | Any member can submit a match; it enters `pending` until the owner approves or rejects |

In all cases, only a participant of a match can add it to a collection. Removing a match from a collection does not delete the match itself.

---

### 3.5 Placeholder Participant — Claim System

When a guest participant later creates an account:

1. They search for matches where their name was used as a placeholder.
2. They submit a **claim request** (`claim_status = pending`).
3. The **match creator** approves or rejects via notification.
4. On approval: `user_id` is updated to the claimant's ID. They can then confirm the match, triggering their rating update.

---

### 3.6 Placeholder Deck — Retroactive Update

1. "Unknown Deck" is assigned when the commander is not known at logging time.
2. Any **linked participant** in that match can later update their own slot to point to the correct deck.
3. Deck-based stats recalculate automatically to reflect the update.

---

## 5. Tracked Metrics

Only **win/loss** is recorded per match — no manual stat entry required. All metrics are derived from results, deck associations, and participants.

### Player Metrics (Global & Per-Format)
- Rating (current value + history over time)
- Win rate overall, per format, per deck, per opponent
- Win rate by table size (e.g., 3-player vs. 4-player FFA)
- Games played (overall, per deck, per format)
- Current win/loss streak; longest win streak

### Head-to-Head
- Record vs. a specific player
- Record vs. a specific deck/commander
- Toughest opponents and most favourable matchups

### Deck Insights
- Win rate per deck
- Most-played deck
- Deck vs. deck matchup history

### Pod / Collection Insights
- Collection-scoped Rating leaderboard (members only, within that collection)
- Collection activity over time (games per month)
- Most-played format and most common decks within the collection

---

## 6. User-Facing Features (Planned)

### Dashboard

The dashboard is **publicly accessible** and displays different content based on authentication state.

**Logged Out — Global Dashboard**

Showcases platform activity and provides social proof to visitors:
- Global leaderboards (top rated players per format)
- Recent matches across the platform
- Most played commanders/decks
- Platform stats (total matches played, active players, etc.)
- Clear call to action to sign up

**Logged In — Personal Dashboard**

Two primary views, toggleable:

*Rating View*
- Current Rating per format (reflects opponent strength, bracket differential, experience)
- Rating history chart over time
- Pending match confirmations
- Recent matches with rating delta per match

*Win Rate View*
- Overall win rate and per-format win rate
- Win rate per deck/commander
- Win/loss record vs. specific opponents
- Current and longest win streak

Both views show:
- Recent match activity and link to the full match log
- Pods/collections activity feed
- Quick action to log a new match

### Collection Dashboard
- Collection-scoped Rating leaderboard among members
- Collection activity feed and full match history
- Per-member win rates within the collection

### Match Log
- Full match history with filters (format, date, deck, result)
- Match detail view: participants, decks, rating deltas per player

### Profile Page
- Public stats: Rating by format, win rates, deck breakdown
- Match history (paginated)
- Head-to-head record visible to both players

### Deck Manager
- Add, edit, and retire commanders/decks
- **Bracket (1–4) is required** when creating a deck — used in rating calculations
- Per-deck stats: win rate, games played, rating impact
- Scryfall API autocomplete (future)

### Collections
- Create and name collections freely
- Configure match add permissions and public/private visibility
- Invite and manage members
- Collection-scoped Rating and stats dashboard

### Friends
- Send/accept friend requests
- Quick-add from friends list when logging a match
- Friends' recent activity feed

### Notifications
- Match confirmation requests
- Participant claim requests
- Collection match approval requests
- Friend requests

---

## 7. Design Principles

- **Extensible formats** — new game modes are config-driven, not hardcoded.
- **Lightweight match logging** — only the winner is required; everything else is optional or retroactively correctable.
- **Graceful placeholders** — the system never blocks match creation due to missing accounts or decks.
- **Confirmation-gated ratings** — no player's rating moves without their own confirmation.
- **Immutable audit trail** — rating history is append-only; no silent retroactive mutations.
- **Dual rating scope** — global and collection-scoped ratings maintained in parallel, updated simultaneously on confirmation.
- **Ownership model** — match creators and collection owners have final authority within their domain.

---

## 8. Future Considerations

- **Scryfall API** for commander autocomplete and color identity lookup
- **Deck archetypes / power level tags** (e.g., CEDH, Casual, 1–10 scale)
- **Match disputes** — allow participants to flag incorrect results
- **Global leaderboards** — per format, public or friends-only
- **Tournaments** — structured bracket or round-robin events within a collection
- **Mobile app** (React Native or PWA)