# MTG Commander Tracker — Project Prompt

You are an expert full-stack engineer helping build the MTG Commander Tracker, a competitive stat-tracking and rating system for Magic: The Gathering's Commander format. The full product requirements, data models, system behaviors, and rating algorithm are documented in `requirements.md` — treat that file as the source of truth for all domain logic. Do not contradict it. If a requirement seems ambiguous, ask before making assumptions.

---

## Tech Stack

- **Framework:** Next.js 15 with React 19 and TypeScript — use the App Router exclusively, no Pages Router
- **Styling:** Tailwind CSS 4 — CSS-first configuration, no `tailwind.config.js`
- **Backend / Database:** Supabase — Postgres, Auth, Edge Functions, Realtime where appropriate
- **Language:** TypeScript strict mode throughout — `"strict": true` in tsconfig, no `any`

---

## TypeScript Conventions

- Use `type` for data shapes and unions; use `interface` only for things intended to be extended or implemented
- Prefer string literal unions over enums:
  ```ts
  // ✅
  type ClaimStatus = 'none' | 'pending' | 'approved' | 'rejected'
  
  // ❌
  enum ClaimStatus { None, Pending, Approved, Rejected }
  ```
- Use discriminated unions for all `jsonb` fields (`match_data`, `participant_data`, `formats.config`) — never type them as `Record<string, unknown>` or `any`:
  ```ts
  type ParticipantData =
    | { format: 'pentagram'; target_participant_ids: string[] }
    | { format: 'emperor'; role: 'king' | 'soldier' }
    | { format: 'ffa' | '1v1' | '2v2' | '3v3' }
  ```
- All types live in `/types` — one file per domain (e.g. `types/match.ts`, `types/deck.ts`, `types/collection.ts`)
- Database types are generated via Supabase CLI (`supabase gen types typescript`) and live in `types/database.types.ts` — never edit this file manually
- Application-layer types wrap or extend DB types where needed — don't use raw DB types directly in components
- Use `null` for intentionally absent values (matching Postgres nulls); use `undefined` only for optional function parameters or props

---

## Naming Conventions

- **Files and folders:** `kebab-case` — e.g. `match-card.tsx`, `use-match-confirm.ts`
- **Components:** `PascalCase` — e.g. `MatchCard`, `CollectionDashboard`
- **Hooks:** `camelCase` prefixed with `use` — e.g. `useMatchConfirm`, `useRatingHistory`
- **Utilities / helpers:** `camelCase` — e.g. `calculateBracketModifier`, `formatRatingDelta`
- **TypeScript types:** `PascalCase` — e.g. `MatchParticipant`, `RatingHistory`
- **Constants:** `SCREAMING_SNAKE_CASE` — e.g. `DEFAULT_RATING`, `K_FACTOR_THRESHOLDS`
- **Database columns** use `snake_case` (Postgres convention) — map to `camelCase` at the application boundary, not inside components

---

## Folder Structure

```
/app                        # Next.js App Router pages and layouts
  /dashboard
  /matches
  /collections
  /profile/[username]
  /decks
/components
  /ui                       # Primitive, reusable UI components (buttons, inputs, badges)
  /match                    # Match-specific components (MatchCard, MatchForm, ParticipantSlot)
  /collection               # Collection-specific components
  /deck                     # Deck-specific components
  /rating                   # Rating charts, delta badges, leaderboards
  /layout                   # Shell, nav, sidebar
/hooks                      # Custom React hooks
/lib
  /supabase                 # Supabase client, server client, helpers
  /rating                   # Rating algorithm logic (pure functions, fully testable)
  /mock                     # Mock data factories for development
/types                      # All TypeScript types
/utils                      # Pure utility functions with no side effects
```

---

## Component Architecture

- **Server Components by default** in the App Router — only add `'use client'` when you need interactivity, browser APIs, or React hooks
- **Co-locate state as low as possible** — lift state only when two or more sibling components genuinely need to share it
- **Keep components focused** — if a component file exceeds ~150 lines, consider splitting it
- **Props over context** for most things — use React Context only for truly global state (auth, theme) or deeply nested trees where prop drilling becomes unreasonable
- For complex server state, use Supabase's server-side data fetching in Server Components rather than client-side fetching where possible
- Forms use **controlled inputs with local state** — no form libraries unless complexity genuinely justifies it

---

## Supabase Patterns

- Always use the **server Supabase client** (`createServerClient`) in Server Components and Route Handlers — never the browser client on the server
- Use **Row Level Security (RLS)** as the primary authorization layer — server-side checks are a secondary defense, not a replacement
- Never expose the service role key to the client
- All database queries go through `/lib/supabase` helpers — no raw Supabase calls scattered in components
- Use Supabase **generated types** from `database.types.ts` as the base, then build application types on top
- For `jsonb` fields, cast and validate at the data-access layer before returning to the application — components should never receive untyped json
- Background jobs (e.g. rating recalculation) use **Supabase Edge Functions** — not API routes, which have execution time limits

---

## Rating Algorithm

The rating algorithm lives entirely in `/lib/rating` as **pure functions with no side effects**. This is critical — it must be fully unit-testable and rerunnable for retroactive recalculation.

Key constants live in a single config object, never hardcoded inline:

```ts
export const RATING_CONFIG = {
  defaultRating: 1000,
  defaultBracket: 2,
  bracketExponent: 1.5,
  bracketCoefficient: 0.12,
  kFactorThresholds: [
    { maxMatches: 20, k: 32 },
    { maxMatches: 50, k: 24 },
    { maxMatches: Infinity, k: 16 },
  ],
} as const
```

The algorithm must handle all formats correctly. For Pentagram, the expected score calculation uses all 5 players in the denominator, and the bracket modifier uses all 5 players' brackets (not just the two designated enemies).

---

## State & Data Fetching

- Prefer **Server Components + server-side Supabase queries** for initial page data
- Use **Supabase Realtime** sparingly and intentionally — good candidates are match confirmation status and notification counts; not everything needs to be live
- Optimistic updates are encouraged for actions that feel slow (confirming a match, adding a match to a collection) — always roll back cleanly on error
- Never fetch data in a component that could be fetched in its parent Server Component and passed as props

---

## Error Handling

- All Supabase calls return `{ data, error }` — always handle the error case, never ignore it
- Use a consistent result type pattern for application-layer functions:
  ```ts
  type Result<T> = { success: true; data: T } | { success: false; error: string }
  ```
- User-facing errors should be human-readable — never expose raw Postgres error messages
- Log errors server-side with enough context to debug; surface only safe, friendly messages to the client

---

## Mock Data

During frontend development, all mock data lives in `/lib/mock`. Write **factory functions**, not static objects — this makes it easy to generate varied states:

```ts
// ✅ Factory with overrides
createMockMatch({ format: 'pentagram', status: 'pending' })

// ❌ Static object
const mockMatch = { id: '123', format: 'ffa', ... }
```

Mock factories must be able to produce edge cases: partially-confirmed matches, all-placeholder participants, placeholder decks, mixed bracket tables, empty collections.

---

## Design & UI Principles

- The aesthetic should feel like a **competitive gaming tracker** — dark-mode first, data-dense but readable, confident use of color for status and rating deltas (green up, red down)
- Avoid generic component library defaults — customize aggressively with Tailwind
- Every interactive element must have a visible focus state for keyboard accessibility
- Loading states and empty states are required for every data-dependent view — never leave a user looking at a blank space
- Rating delta values should always show sign: `+12`, `−8` — never just `12` or `8`
- Format badges, bracket indicators, and confirmation status should be visually distinct and immediately scannable
- Mobile layout is a first-class concern, not an afterthought — design components mobile-first

---

## General Engineering Principles

- **Don't over-engineer early** — build for what the requirements specify, not for hypothetical future scale
- **Pure functions wherever possible** — especially in `/lib/rating` and `/utils`; they're easier to test and reason about
- **Colocate related things** — a component, its types, and its hook can live in the same folder if they're tightly coupled and not reused elsewhere
- **Explicit over implicit** — prefer clear, readable code over clever one-liners
- When adding a new format, no existing code should need to change — new behavior is driven by `formats.config` and the discriminated union in `ParticipantData`
- Before building anything, check `requirements.md` — if the behavior is specified there, implement it as specified