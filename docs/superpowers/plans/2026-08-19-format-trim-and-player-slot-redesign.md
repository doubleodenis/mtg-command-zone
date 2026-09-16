# Format Trim & Player-Slot Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deactivate the 2v2 and 3v3 formats (reversibly, via `is_active`), and restructure the player-slot cards on the log-match page into a clearer two-zone (identity header + details) layout, applied consistently to FFA/1v1 (`PlayerSlot`) and Pentagram (`PentagonPlayerCard`).

**Architecture:** Formats are already config-driven through the `formats` table's `is_active` flag, so removal is a single SQL migration with zero application code changes. The player-slot redesign is a pure JSX/styling restructuring of two existing client components — no prop, state, or data-flow changes, so every existing handler wiring in `MatchForm` and `PentagramLayout` continues to work unmodified.

**Tech Stack:** Next.js 16 (React 19, TypeScript), Tailwind CSS 4, Supabase Postgres (SQL migrations), Vitest.

## Global Constraints

- No changes to `FormatConfig`, `MatchData`, `ParticipantData` types (`src/types/format.ts`).
- No changes to `PlayerSlotProps`, `PentagonPlayerCardProps`, `PentagramLayoutProps`, or `ParticipantSlot` (`src/components/match/match-form-types.ts`).
- No removal of 2v2/3v3 code or historical data — deactivation only, via `is_active = false`.
- Use existing design tokens only (`bg-card`, `bg-card-raised`, `border-card-border`, `text-text-1`, `text-text-2`, `text-text-3`, `bg-win`, `bg-loss`, `bg-accent`, etc.) — no new colors or ad hoc hex values.
- TypeScript strict — no `any`.

---

### Task 1: Deactivate 2v2 and 3v3 formats

**Files:**
- Create: `supabase/migrations/021_deactivate_team_formats.sql`

**Interfaces:**
- Consumes: existing `formats` table schema (`slug`, `is_active` columns), already defined in `supabase/migrations/001_initial_schema.sql`.
- Produces: nothing consumed by later tasks — this task is independent of Task 2 and Task 3.

- [ ] **Step 1: Write the migration**

```sql
-- Temporarily deactivate 2v2 and 3v3 formats to focus on traditional Commander play patterns.
-- Reversible: flip is_active back to true on these rows to restore them.

UPDATE formats SET is_active = false WHERE slug IN ('2v2', '3v3');
```

- [ ] **Step 2: Apply the migration locally and verify**

Run: `npx supabase migration up` (or the project's standard local-apply command if different — check `package.json` scripts first for a `db:migrate`-style alias before falling back to the Supabase CLI directly).

Then verify with a query:

```bash
npx supabase db execute --sql "SELECT slug, is_active FROM formats ORDER BY slug;"
```

Expected: `2v2` and `3v3` rows show `is_active = false`; `1v1`, `ffa`, `pentagram` show `is_active = true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/021_deactivate_team_formats.sql
git commit -m "feat: deactivate 2v2 and 3v3 formats"
```

---

### Task 2: Redesign PlayerSlot into a two-zone card

**Files:**
- Modify: `src/components/match/player-slot.tsx`

**Interfaces:**
- Consumes: `PlayerSlotProps` and `ParticipantSlot` as already defined in `src/components/match/match-form-types.ts` — unchanged.
- Produces: same rendered component `PlayerSlot`, same exported signature, consumed unchanged by `src/components/match/match-form.tsx` (all three call sites: Team A, Team B, non-team FFA list).

This task only restructures JSX/className output. All existing `React.useState`, `React.useEffect`, and handler logic (search, friends loading, commander search, `handleSelect`, `handleSendFriendRequest`, `handleCommanderSelect`) stay exactly as they are — only what's returned from the two `return` blocks changes.

- [ ] **Step 1: Restructure the empty-slot return block**

Keep all existing state/effects unchanged. Replace the empty-slot `return` block (currently starting at `if (slot.type === "empty") {`) with a version that keeps the exact same dropdown content (add-yourself, guest, friends, search results with friend-request buttons) but tightens the outer card spacing and border radius per the approved design (Option B, "empty state: same content, tightened card"):

```tsx
  // Empty slot - show search with integrated guest option
  if (slot.type === "empty") {
    return (
      <div className="p-3 rounded-xl border border-dashed border-card-border bg-card-raised/30">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs font-medium text-text-2">
            Player {index + 1}
            {isTeamFormat && team && ` • Team ${team}`}
          </span>
        </div>
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Search players or add guest..."
            className="h-9 text-sm pr-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )}

          {/* Dropdown with search results and guest option */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl">
              {/* Add yourself option */}
              {currentUser && !excludeIds.includes(currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelect(currentUser);
                  }}
                  className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
                >
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName || currentUser.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-accent text-xs font-medium">
                        {(currentUser.displayName || currentUser.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-1">Add yourself</p>
                    <p className="text-xs text-text-2">@{currentUser.username}</p>
                  </div>
                </button>
              )}

              {/* Guest option */}
              <button
                type="button"
                onClick={() => {
                  onSetAsGuest();
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
              >
                <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center">
                  <span className="text-text-2 text-sm">👤</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-1">Add as Guest</p>
                  <p className="text-xs text-text-2">Player without account</p>
                </div>
              </button>

              {/* Search results */}
              {results.length > 0 && (
                <>
                  {results.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent/10 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(player)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.username}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center">
                            <span className="text-text-2 text-xs font-medium">
                              {player.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-1 truncate">
                            {player.displayName || player.username}
                          </p>
                          <p className="text-xs text-text-2">@{player.username}</p>
                        </div>
                      </button>
                      {/* Friend status / Add friend button */}
                      <div className="shrink-0">
                        {player.isFriend ? (
                          <span className="text-xs text-win font-medium px-2">Friend</span>
                        ) : player.friendshipStatus === "pending" ? (
                          <span className="text-xs text-text-3 px-2">Pending</span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-accent hover:text-accent"
                            onClick={(e) => handleSendFriendRequest(e, player.id)}
                            disabled={sendingRequestTo === player.id}
                          >
                            {sendingRequestTo === player.id ? "..." : "+ Friend"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Friends section when not searching */}
              {query.length < 2 && (
                <>
                  {isFriendsLoading && (
                    <div className="p-2 text-center text-sm text-text-2">
                      Loading friends...
                    </div>
                  )}
                  {!isFriendsLoading && friends.filter((f) => !excludeIds.includes(f.id)).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-text-3 font-medium border-b border-card-border">
                        Friends
                      </div>
                      {friends
                        .filter((f) => !excludeIds.includes(f.id))
                        .map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => handleSelect(player)}
                            className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors"
                          >
                            {player.avatarUrl ? (
                              <img
                                src={player.avatarUrl}
                                alt={player.username}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center">
                                <span className="text-text-2 text-xs font-medium">
                                  {player.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-1 truncate">
                                {player.displayName || player.username}
                              </p>
                              <p className="text-xs text-text-2">@{player.username}</p>
                            </div>
                            <span className="text-xs text-win font-medium px-2">Friend</span>
                          </button>
                        ))}
                    </>
                  )}
                  {!isFriendsLoading && friends.filter((f) => !excludeIds.includes(f.id)).length === 0 && friendsLoaded && (
                    <div className="p-2 text-center text-xs text-text-2">
                      Type to search for players
                    </div>
                  )}
                </>
              )}

              {/* No results message */}
              {query.length >= 2 && results.length === 0 && !isLoading && (
                <div className="p-2 text-center text-sm text-text-2">
                  No players found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
```

(Only the outer wrapper `rounded-lg` → `rounded-xl` and header margin `mb-2` → `mb-2.5` changed vs. today — everything else in this block is unchanged, included here in full because later steps replace the whole file section by section and a partial diff would break JSX balance.)

- [ ] **Step 2: Restructure the filled-slot return block into header + divider + details**

Replace the filled-slot `return` block (the `// Filled slot - show player card` section, from `return (` after the empty-slot block through the end of the function) with the two-zone structure:

```tsx
  // Filled slot - two-zone card: identity header, then details below a divider
  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full rounded-xl border transition-all",
        slot.isWinner
          ? "bg-win/10 border-win/50"
          : "bg-card border-card-border"
      )}
    >
      {/* Header zone: avatar, name/guest-input, action icons */}
      <div className="flex items-center gap-3 p-3">
        <div className="shrink-0">
          {slot.type === "registered" && slot.avatarUrl ? (
            <img
              src={slot.avatarUrl}
              alt={slot.username}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-card-raised flex items-center justify-center">
              <span className="text-text-2 text-sm font-medium">
                {slot.type === "registered"
                  ? slot.username?.charAt(0).toUpperCase()
                  : "👤"}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {slot.type === "registered" ? (
            <>
              <p className="text-sm font-medium text-text-1 truncate">
                {slot.displayName || slot.username}
              </p>
              <p className="text-xs text-text-2">@{slot.username}</p>
            </>
          ) : (
            <Input
              value={slot.placeholderName || ""}
              onChange={(e) => onChangePlaceholderName(e.target.value)}
              placeholder="Guest name"
              className="h-8 text-sm"
              autoFocus
            />
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {!hideWinnerButton && (
            <button
              type="button"
              onClick={onToggleWinner}
              className={cn(
                "p-1.5 rounded transition-colors text-xs",
                slot.isWinner
                  ? "bg-win text-text-1"
                  : "bg-card-raised text-text-2 hover:text-text-1"
              )}
              title={slot.isWinner ? "Remove winner" : "Mark as winner"}
            >
              <Trophy className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded bg-card-raised text-text-2 hover:text-loss hover:bg-loss/10 transition-colors text-xs"
            title="Clear"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Details zone: deck picker (registered) or commander search (guest) */}
      <div className="border-t border-card-border p-3 pt-2.5">
        {/* Commander search for guest players */}
        {slot.type === "placeholder" && (
          <div className="relative">
            {slot.commanderName ? (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex-1 h-8 text-sm rounded-md border px-2 flex items-center",
                  "bg-accent/10 border-accent/30 text-text-1"
                )}>
                  {slot.commanderName}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeCommanderName("")}
                  className="p-1 text-text-2 hover:text-loss transition-colors"
                  title="Clear commander"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={commanderQuery}
                  onChange={(e) => setCommanderQuery(e.target.value)}
                  onFocus={() => commanderResults.length > 0 && setIsCommanderOpen(true)}
                  onBlur={() => setTimeout(() => setIsCommanderOpen(false), 200)}
                  placeholder="Search commander..."
                  className="h-8 text-sm"
                />
                {isCommanderLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  </div>
                )}
                {isCommanderOpen && commanderResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl max-h-48 overflow-y-auto">
                    {commanderResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleCommanderSelect(card)}
                        className="w-full p-2 text-left hover:bg-accent/10 transition-colors text-sm text-text-1 truncate"
                      >
                        {card.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Deck selector for registered users */}
        {slot.type === "registered" && availableDecks.length > 0 && (
          <Select
            value={slot.deckId || ""}
            onChange={(value) => onSelectDeck(value)}
            placeholder="Select commander..."
            options={availableDecks.map((deck) => ({
              value: deck.id,
              label: `${deck.commanderName}${deck.deckName ? ` (${deck.deckName})` : ''}`,
            }))}
          />
        )}

        {/* No decks message for registered users */}
        {slot.type === "registered" && availableDecks.length === 0 && (
          <div className="p-2 rounded-md bg-card-raised border border-card-border">
            <p className="text-xs text-text-2">
              Deck TBD • Player will set during confirmation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check and lint**

Run: `npm run lint`
Expected: no errors in `src/components/match/player-slot.tsx`.

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual visual verification**

Run: `npm run dev`, navigate to `/matches/new`, select the FFA format, and check:
- Empty slot shows the search/guest/friends dropdown identically to before, in a card with slightly larger rounded corners.
- Selecting "Add as Guest" flips the slot into the header (guest name input, avatar placeholder, winner/remove icons) + divider + commander-search-below-divider layout.
- Selecting a registered player (e.g. "Add yourself") shows their avatar/name in the header and the deck `Select` below the divider.
- Toggling the winner trophy icon and removing a slot both work as before.
- Switch to 1v1 format and confirm `hideWinnerButton` still hides the trophy icon in the header for team members (winner is set at team level from `MatchForm`).

- [ ] **Step 5: Commit**

```bash
git add src/components/match/player-slot.tsx
git commit -m "refactor: restructure PlayerSlot into two-zone header/details card"
```

---

### Task 3: Redesign PentagonPlayerCard into a two-zone card

**Files:**
- Modify: `src/components/match/pentagram-layout.tsx`

**Interfaces:**
- Consumes: `PentagonPlayerCardProps`, `PentagramLayoutProps` as already defined in `src/components/match/match-form-types.ts` — unchanged.
- Produces: same rendered component `PentagramLayout` (default export usage in `match-form.tsx` is `import { PentagramLayout } from "./pentagram-layout"` — unchanged), same internal `PentagonPlayerCard` behavior, wired identically from both the desktop absolute-positioned pentagon and the mobile stacked list.

Only the `PentagonPlayerCard` function's two `return` blocks change. All state/effects (search, friends, commander search, `handleSendFriendRequest`) and the outer `PentagramLayout` function (SVG lines, positioning, `focusedIndex`/`enemyIndices` logic) stay unchanged.

- [ ] **Step 1: Restructure the empty-slot return block**

Replace the empty-slot `return` block (`if (slot.type === "empty") {`) with a tightened version — same dropdown content, `rounded-lg` → `rounded-xl`:

```tsx
  // Empty slot
  if (slot.type === "empty") {
    return (
      <div 
        className={cn(
          "w-full p-3 rounded-xl border border-dashed bg-card-raised/30 transition-colors",
          isEnemyHighlighted ? "border-loss/70 bg-loss/5" : "border-card-border"
        )}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
      >
        <div className={cn(
          "text-sm mb-2 text-center font-medium",
          isEnemyHighlighted ? "text-loss" : "text-text-2"
        )}>
          Seat {index + 1}{isEnemyHighlighted && " — Enemy"}
        </div>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsOpen(true);
              onFocusChange?.(true);
            }}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200);
              onFocusChange?.(false);
            }}
            placeholder="Add player..."
            className="h-9 text-sm"
          />
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl text-sm">
              {/* Add yourself option */}
              {currentUser && !excludeIds.includes(currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPlayer(currentUser);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
                >
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent/20 text-xs flex items-center justify-center text-accent">
                      {currentUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-text-1">Add yourself</span>
                </button>
              )}
              {/* Guest option */}
              <button
                type="button"
                onClick={() => {
                  onSetAsGuest();
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
              >
                <span>👤</span>
                <span className="text-text-1">Guest</span>
              </button>
              {results.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent/10 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlayer(player);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-card-raised text-xs flex items-center justify-center shrink-0">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-text-1 truncate">{player.username}</span>
                  </button>
                  {/* Friend status / Add friend button */}
                  <div className="shrink-0">
                    {player.isFriend ? (
                      <span className="text-xs text-win">✓</span>
                    ) : player.friendshipStatus === "pending" ? (
                      <span className="text-xs text-text-3">•••</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-accent hover:text-accent"
                        onClick={(e) => handleSendFriendRequest(e, player.id)}
                        disabled={sendingRequestTo === player.id}
                      >
                        +
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {/* Friends section when not searching */}
              {query.length < 2 && (
                <>
                  {isFriendsLoading && (
                    <div className="p-2 text-center text-text-2">
                      Loading...
                    </div>
                  )}
                  {!isFriendsLoading && friends.filter((f) => !excludeIds.includes(f.id)).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-text-3 font-medium border-b border-card-border">
                        Friends
                      </div>
                      {friends
                        .filter((f) => !excludeIds.includes(f.id))
                        .map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              onSelectPlayer(player);
                              setQuery("");
                              setIsOpen(false);
                            }}
                            className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors"
                          >
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-card-raised text-xs flex items-center justify-center">
                                {player.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-text-1 truncate flex-1">{player.displayName || player.username}</span>
                            <span className="text-xs text-win">✓</span>
                          </button>
                        ))}
                    </>
                  )}
                </>
              )}
              {query.length >= 2 && results.length === 0 && !isLoading && (
                <div className="p-2 text-center text-text-2">No results</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Restructure the filled-slot return block into header + divider + details**

Replace the filled-slot section (from `const displayName = slot.type === "registered"` through the end of the `PentagonPlayerCard` function) with:

```tsx
  // Filled slot - two-zone card: identity header, then details below a divider
  const displayName = slot.type === "registered" 
    ? (slot.displayName || slot.username || "Player")
    : (slot.placeholderName || "Guest");

  return (
    <div
      className={cn(
        "w-full rounded-xl border transition-all",
        isEnemyHighlighted 
          ? "bg-loss/10 border-loss/50" 
          : slot.isWinner 
            ? "bg-win/10 border-win/50" 
            : "bg-card border-card-border"
      )}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    >
      {/* Enemy indicator for mobile */}
      {isEnemyHighlighted && (
        <div className="text-xs text-loss font-medium text-center pt-2">⚔️ Enemy</div>
      )}

      {/* Header zone: avatar, name/guest-input, action icons */}
      <div className="flex items-center gap-2 p-3">
        <div className="shrink-0">
          {slot.type === "registered" && slot.avatarUrl ? (
            <img src={slot.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-sm text-text-2">
              {slot.type === "registered" ? displayName.charAt(0).toUpperCase() : "👤"}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {slot.type === "registered" ? (
            <span className="text-sm font-medium text-text-1 truncate block">{displayName}</span>
          ) : (
            <Input
              value={slot.placeholderName || ""}
              onChange={(e) => onChangePlaceholderName(e.target.value)}
              placeholder="Guest name"
              className="h-8 text-sm"
            />
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleWinner}
            className={cn(
              "p-1.5 rounded text-sm",
              slot.isWinner ? "bg-win text-text-1" : "text-text-2 hover:text-text-1"
            )}
          >
            <Trophy className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded text-sm text-text-2 hover:text-loss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Details zone: deck picker (registered) or commander search (guest) */}
      <div className="border-t border-card-border p-3 pt-2.5">
        {slot.type === "registered" && availableDecks.length > 0 && (
          <Select
            value={slot.deckId || ""}
            onChange={(value) => onSelectDeck(value)}
            placeholder="Commander..."
            options={availableDecks.map((deck) => ({
              value: deck.id,
              label: deck.commanderName,
            }))}
          />
        )}

        {slot.type === "registered" && availableDecks.length === 0 && (
          <div className="p-1.5 rounded bg-card-raised border border-card-border">
            <p className="text-xs text-text-2 text-center">Deck TBD</p>
          </div>
        )}

        {slot.type === "placeholder" && (
          <div className="relative">
            {slot.commanderName ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 h-8 text-sm rounded border px-2 flex items-center bg-accent/10 border-accent/30 text-text-1 truncate">
                  {slot.commanderName}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeCommanderName("")}
                  className="text-sm text-text-2 hover:text-loss"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={commanderQuery}
                  onChange={(e) => setCommanderQuery(e.target.value)}
                  onFocus={() => commanderResults.length > 0 && setIsCommanderOpen(true)}
                  onBlur={() => setTimeout(() => setIsCommanderOpen(false), 200)}
                  placeholder="Commander..."
                  className="h-8 text-sm px-2"
                />
                {isCommanderOpen && commanderResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl max-h-40 overflow-y-auto">
                    {commanderResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          onChangeCommanderName(card.name);
                          setCommanderQuery("");
                          setIsCommanderOpen(false);
                        }}
                        className="w-full p-2 text-left hover:bg-accent/10 transition-colors text-sm text-text-1 truncate"
                      >
                        {card.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check and lint**

Run: `npm run lint`
Expected: no errors in `src/components/match/pentagram-layout.tsx`.

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual visual verification**

Run: `npm run dev` (if not already running), navigate to `/matches/new`, select the Pentagram format, and check:
- Desktop pentagon layout: all 5 seat cards render at their vertex positions with the new header/divider/details structure; enemy highlighting (dashed red border on empty, red-tinted fill on filled) still works when a card is focused.
- Mobile view (resize below `md` breakpoint): cards stack vertically with the same structure.
- Guest flow: adding a guest at a seat shows the name input in the header and commander search below the divider.
- Registered player flow: selecting a player shows their avatar/name in the header and the deck `Select` below the divider.
- Winner toggle and remove (✕) icons in the header work as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/match/pentagram-layout.tsx
git commit -m "refactor: restructure PentagonPlayerCard into two-zone header/details card"
```

---

### Task 4: Full regression pass across all active formats

**Files:** none (verification only)

**Interfaces:**
- Consumes: the completed `MatchForm` (`src/components/match/match-form.tsx`), `PlayerSlot`, and `PentagramLayout` from Tasks 1–3.
- Produces: nothing — this is the final gate before considering the branch done.

- [ ] **Step 1: Run the full automated check suite**

```bash
npm run lint
npx tsc --noEmit
npm run test:run
```

Expected: all pass with no errors (component restructuring introduced no new logic, so existing `src/lib/__tests__/rating.test.ts` and other suites should be unaffected).

- [ ] **Step 2: Manual end-to-end walkthrough**

Run: `npm run dev`, navigate to `/matches/new`, and confirm:
- The format selector only offers **1v1**, **FFA**, and **Pentagram** — no 2v2/3v3 buttons appear.
- FFA: add 3+ players (mix of registered/guest), assign decks, mark a winner, submit — match creates successfully (redirects to `/match/[id]`).
- 1v1: add 2 players to Team A/Team B, mark a team winner via the team-level trophy button, submit successfully.
- Pentagram: fill all 5 seats (mix of registered/guest), mark a winner, submit successfully.
- Navigate to an existing match that was logged under 2v2 or 3v3 before this change (if one exists in local seed data) and confirm its match detail page still renders correctly.

- [ ] **Step 3: Commit (only if Step 1/2 surfaced fixes)**

If no fixes were needed, skip this step — Tasks 1–3 already committed the substantive changes.

```bash
git add -A
git commit -m "fix: address regressions found in end-to-end verification"
```
