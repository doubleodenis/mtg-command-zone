## Plan: MTG Commander Match Tracker

**TL;DR:** Build a NextJS 16 + Supabase app for tracking Commander matches with OAuth login (Google/Discord), Steam-like friend system, Scryfall-powered commander search, and match statistics. **Public browsing** — anyone can search players and view match history without logging in; login required only for creating/editing matches. Visual design inspired by competitive gaming stat trackers (Leetify, Statlocker) — dark theme, neon accents, animated stat cards, and data-rich player profiles. The database design accommodates guest players (non-registered) via a `guest_participants` approach. Deploys to Netlify with automatic Next.js detection.

---

### Steps

**1. Project Scaffolding**
- Run `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir`
- Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `server-only`, `client-only`, `framer-motion`, `recharts`, `@radix-ui/react-*` (primitives)
- Create folder structure:
  ```
  src/
  ├── app/
  │   ├── page.tsx              → Landing page (search bar + trending)
  │   ├── player/[username]/    → Public player profile (no auth)
  │   ├── match/[id]/           → Public match detail (no auth)
  │   ├── (auth)/               → login, callback routes
  │   ├── (dashboard)/          → Protected routes (requires auth)
  │   │   ├── matches/new/      → Create match
  │   │   ├── friends/          → Friend management
  │   │   ├── commanders/       → My commander collection
  │   │   ├── groups/           → My groups
  │   │   └── settings/         → Profile settings
  ├── components/ui/            → Reusable components
  ├── components/features/      → match-card, commander-picker, friend-list
  ├── lib/supabase/             → client.ts, server.ts
  ├── lib/scryfall/             → api.ts (search, autocomplete)
  ├── types/                    → database.types.ts (Supabase generated)
  ```

**2. Supabase Project Setup**
- Create Supabase project
- Enable OAuth providers in Dashboard → Auth → Providers:
  - **Google**: Add OAuth 2.0 credentials from Google Cloud Console
  - **Discord**: Add Client ID/Secret from Discord Developer Portal
- Configure redirect URL: `https://<project>.supabase.co/auth/v1/callback`
- Set environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**3. Database Schema (SQL migrations)**

| Table | Purpose |
|-------|---------|
| `profiles` | Extends auth.users with username, display_name, avatar |
| `user_commanders` | User's commander collection (cached Scryfall data) |
| `friendships` | Request/accept model with status enum |
| `groups` | Tournament/playgroup containers |
| `group_members` | Many-to-many with roles |
| `matches` | Core match record (format, date, optional group) |
| `match_participants` | Registered players in a match |
| `guest_participants` | **Non-registered players** — stores name + commander text |

Key schema decisions:
- `guest_participants` table for players without accounts (manual name/commander input)
- `matches.format` enum: `1v1`, `2v2`, `multiplayer`
- `match_participants.team` column for 2v2 team grouping
- `match_participants.is_winner` + `placement` for flexible win tracking
- Cache Scryfall `card_name`, `card_image_uri`, `scryfall_id` in `user_commanders` to minimize API calls

**4. Row Level Security (RLS)**
- `profiles`: **Public read (anonymous + authenticated)**, self-update only
- `matches`: **Public read (anonymous + authenticated)**, creator can update/delete
- `match_participants`: **Public read**, insert/update by match creator
- `guest_participants`: **Public read**, insert/update by match creator
- `friendships`: Both parties can view, requester can cancel pending, addressee can accept/decline
- `user_commanders`: **Public read** (for profile display), owner-only insert/update/delete
- `groups`: Public read, owner/admin can modify

**Auth requirement matrix:**
| Action | Auth Required? |
|--------|---------------|
| Search players | No |
| View player profile | No |
| View match history | No |
| View match details | No |
| Create match | **Yes** |
| Edit/delete match | **Yes** (creator only) |
| Add friends | **Yes** |
| Manage commanders | **Yes** |

**5. Auth Implementation**
- Create `src/lib/supabase/client.ts` (browser client using `createBrowserClient`)
- Create `src/lib/supabase/server.ts` (server client using `createServerClient`)
- Create `src/app/auth/callback/route.ts` — exchanges OAuth code for session
- Create `src/middleware.ts` — refreshes session on each request
- Build login page with Google/Discord OAuth buttons

**6. Scryfall Integration**
- Create `src/lib/scryfall/api.ts` with:
  - `searchCommanders(query)` — uses `GET /cards/search?q=is:commander+{query}`
  - `autocompleteCard(query)` — uses `GET /cards/autocomplete`
  - `getCardById(scryfallId)` — uses `GET /cards/:id`
- Implement 100ms throttling between requests (rate limit: 10/sec)
- Cache responses in localStorage or React state
- Handle multi-face cards (`card_faces` array)

**7. Core Features**

| Feature | Implementation |
|---------|---------------|
| **Landing Page** | Search bar (primary focus) + trending stats below. No auth required. |
| **Player Search** | Autocomplete search by username → navigate to `/player/[username]`. |
| **Public Profile** | View any player's stats, match history, commanders at `/player/[username]`. |
| **Site-wide Stats** | Landing page shows: top commanders (most played), recent matches, leaderboard. |
| **Friend System** | Search users by username → send request → pending/accepted states. Friendship query uses bidirectional check. **(Requires login)** |
| **Commander Collection** | Scryfall autocomplete search → add to `user_commanders` with cached data. Mark favorites. **(Requires login)** |
| **Match Creation** | Form: select format → add participants (friends dropdown OR guest input) → select commander per player → designate winner(s) → optional group. **(Requires login)** |
| **Match Display** | Card showing: date, format, participants with avatars + commanders, winner highlight, group badge. |
| **Groups** | CRUD for groups. Drag/assign matches to groups. Filter matches by group. **(Requires login)** |
| **Guest Players** | Toggle "Add guest" → text inputs for name + commander search → stored in `guest_participants`. |

**Landing Page Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO]                              [Login] [Sign Up]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         🔍  Search for a player...                         │
│         ┌─────────────────────────────────────────┐         │
│         │                                         │         │
│         └─────────────────────────────────────────┘         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [TOP COMMANDERS]           [RECENT MATCHES]                │
│  ┌───────┐ ┌───────┐       ┌──────────────────────┐        │
│  │Kenrith│ │Tymna  │       │ Player1 vs Player2   │        │
│  │ 1.2k  │ │ 980   │       │ 2 hours ago • WIN    │        │
│  │matches│ │matches│       └──────────────────────┘        │
│  └───────┘ └───────┘       ┌──────────────────────┐        │
│                            │ Player3's 4-player   │        │
│                            │ 5 hours ago • LOSS   │        │
│                            └──────────────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  [LEADERBOARD - Top Win Rates]                              │
│  1. @username1  •  78% win rate  •  56 matches             │
│  2. @username2  •  72% win rate  •  143 matches            │
│  3. @username3  •  71% win rate  •  89 matches             │
└─────────────────────────────────────────────────────────────┘
```

**8. Statistics Implementation**
- Create `src/app/(dashboard)/stats/page.tsx`
- SQL views or RPC functions for:
  - Win rate per user (overall + by format)
  - Most played commanders
  - Head-to-head records between friends
  - Win rate by commander
- Display with Recharts (area charts, radial progress, bar charts)
- Animate stat reveals with Framer Motion on page load

**9. UI Components**
| Component | Type | Purpose |
|-----------|------|---------|
| `CommanderPicker` | Client | Scryfall autocomplete + image preview |
| `MatchCard` | Server | Display match with participants |
| `FriendRequestList` | Client | Pending requests with accept/decline |
| `ParticipantSelector` | Client | Multi-select friends + guest toggle |
| `StatsChart` | Client | Win rate visualizations |
| `RadialWinRate` | Client | Circular progress with percentage |
| `StatCard` | Client | Glassmorphic card with icon + value + label |
| `ProfileHero` | Server | Banner with avatar, top commander, key stats |
| `MatchTimeline` | Client | Vertical timeline of recent matches |
| `CommanderShowcase` | Client | Featured commander with win stats overlay |

**10. Visual Design System (Competitive Stat Tracker Aesthetic)**

Inspired by **Leetify.gg** and **Statlocker.gg** — dark, data-rich, gaming-focused.

**Theme & Colors:**
- **Base**: Dark background (`#0a0a0f` / `#12121a`) with subtle noise texture
- **Surface**: Glassmorphic cards with `backdrop-blur`, slight transparency (`rgba(255,255,255,0.03)`)
- **Primary accent**: Electric purple (`#a855f7`) or cyan (`#22d3ee`) — user-configurable
- **Win/Loss**: Green (`#22c55e`) for wins, Red (`#ef4444`) for losses
- **Text**: White for primary, muted gray (`#a1a1aa`) for secondary
- **Borders**: Subtle gradients or glow effects on hover

**Typography:**
- **Font**: Inter or Geist Sans (clean, modern)
- **Headings**: Bold, uppercase for section titles
- **Stats**: Tabular numerals, large size for key metrics

**Profile Page Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [HERO BANNER - gradient bg with avatar + username]         │
│  ┌──────────┐  Win Rate: 67%   Matches: 142   Streak: W5   │
│  │  Avatar  │  Top Commander: [Kenrith art + name]         │
│  └──────────┘                                               │
├─────────────────────────────────────────────────────────────┤
│  [STAT CARDS ROW]                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 🏆 67%  │  │ 📊 142  │  │ 👑 23   │  │ ⚔️ 48   │        │
│  │Win Rate │  │ Matches │  │  Wins   │  │ vs Alex │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
├─────────────────────────────────────────────────────────────┤
│  [COMMANDER PERFORMANCE]         [RECENT MATCHES]          │
│  ┌─────────────────────┐        ┌─────────────────────┐    │
│  │ Radial charts for   │        │ Timeline with W/L   │    │
│  │ top 5 commanders    │        │ indicators, dates   │    │
│  │ by win rate         │        │ opponent avatars    │    │
│  └─────────────────────┘        └─────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [HEAD-TO-HEAD RECORDS]                                     │
│  Friend avatar | W-L record | Win % bar | Last played      │
└─────────────────────────────────────────────────────────────┘
```

**Key Visual Elements:**
- **Radial/Donut charts**: Win rate circles with animated fill (Recharts `RadialBarChart`)
- **Stat cards**: Icon + large number + label, glassmorphic background, hover glow
- **Progress bars**: Gradient fill (purple→cyan) for head-to-head win rates
- **Commander cards**: Scryfall art with dark overlay, stats badge in corner
- **Match cards**: Dark card with colored left border (green=win, red=loss)
- **Animations**: Framer Motion for:
  - Stat number count-up on load
  - Card entrance (staggered fade-in)
  - Chart segment reveals
  - Hover scale/glow effects

**Match History Card:**
```
┌──────────────────────────────────────────────────────────┐
│ ▌ WIN   Commander 4-player   •   March 3, 2026          │
│ ┌─────┬─────┬─────┬─────┐                                │
│ │You  │Alex │Sam  │Guest│   Winner: You (Kenrith)       │
│ │👑   │     │     │     │   Duration: 1h 23m            │
│ └─────┴─────┴─────┴─────┘   Group: Friday Night Magic   │
└──────────────────────────────────────────────────────────┘
```

**CSS/Tailwind Approach:**
- Extend Tailwind config with custom colors (`accent`, `surface`, `win`, `loss`)
- Create CSS variables for theming potential
- Use `@layer components` for reusable stat-card, glassmorphic styles
- Implement dark mode only (no light mode toggle needed)

**Additional Packages:**
- `framer-motion` — animations and transitions
- `recharts` — charts (lightweight, React-native)
- `@radix-ui/react-tooltip`, `@radix-ui/react-dialog` — accessible primitives
- `clsx` + `tailwind-merge` — conditional class merging

**11. Netlify Deployment**
- Push to GitHub
- Connect repo in Netlify Dashboard (auto-detects Next.js)
- Add environment variables in Site settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- OAuth redirect URIs must include your Netlify domain

---

### Verification

1. **Public access (no login)**: Visit landing page → search "testuser" → view their profile and match history
2. **Landing page content**: Top commanders, recent matches, leaderboard all display correctly
3. **Auth flow**: Sign in with Google/Discord → profile created → redirected to dashboard
4. **Protected routes**: Unauthenticated user trying to access `/dashboard/matches/new` → redirected to login
5. **Friends**: Send request → recipient accepts → appears in both friend lists
6. **Commanders**: Search "Kenrith" → add to collection → appears in picker
7. **Match creation**: Create 4-player Commander match with 1 guest → select commanders → mark winner → view in history
8. **Stats**: Play 5+ matches → stats page shows accurate win rates
9. **Groups**: Create "Friday Night Magic" group → assign matches → filter works

---

### Decisions

- **Public-first design**: Landing page is a search bar — encourages discovery, no login friction for viewers
- **Auth for writes only**: RLS policies allow anonymous SELECT on profiles, matches, participants; INSERT/UPDATE/DELETE require authentication
- **Guest participants**: Separate table (`guest_participants`) rather than nullable user_id — keeps schema clean and allows future "claim" feature
- **Scryfall caching**: Store card data in DB rather than fetching on every render — respects rate limits
- **Commander-only formats**: Simplified to Commander variants (1v1, 2v2, multiplayer) per your preference
- **Site-wide aggregations**: Use Supabase RPC functions or materialized views for top commanders and leaderboard (avoids expensive queries on every page load)
