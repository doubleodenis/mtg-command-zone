# CommandZone — Design System

## Folder structure

```
src/
├── app/
│   ├── globals.css                   # resets + body base + typography utilities
│   ├── layout.tsx                    # next/font injection
│   │
│   └── _design-system/
│       ├── tokens/
│       │   ├── theme.css             # @theme block — generates all Tailwind utilities
│       │   ├── tokens.css            # raw CSS custom properties (non-Tailwind use)
│       │   └── tokens.ts             # TypeScript constants + helpers
│       └── index.ts                  # barrel: re-exports tokens
```

---

## What goes where

### `_design-system/tokens/theme.css`
The single source of truth for every design token.
Generates Tailwind utility classes — **token definitions only**.

```css
/* ✅ correct */
--color-accent: #aa28d8;

/* ❌ wrong — component styles don't belong here */
.btn-primary { background: var(--color-accent-fill); }
```

### `app/globals.css`
**Three things only:**
1. `@import "tailwindcss"` and `@import theme.css`
2. CSS resets
3. Typography utility classes (`.text-elo`, `.text-label`, etc.)

Typography utilities are the only "classes" allowed here because they combine
multiple CSS properties (font-family + size + weight + tracking) that can't be
expressed as a single Tailwind utility. They have no color, no layout, no borders.

```css
/* ✅ correct — pure typography, no component concerns */
.text-label {
  font-family: var(--font-data);
  font-size: var(--font-size-sm);
  font-weight: 500;
  letter-spacing: var(--letter-spacing-widest);
  text-transform: uppercase;
}

/* ❌ wrong — this is a component, not a global */
.badge-win {
  background: var(--color-win-subtle);
  border: 1px solid var(--color-win-ring);
  color: var(--color-win);
}
```

### Components — use Tailwind utility classes directly
Components use the generated utility classes. No `.css` files needed.

```tsx
// ✅ WLBadge.tsx — all styles via utility classes
export function WLBadge({ result }: { result: 'win' | 'loss' }) {
  const isWin = result === 'win'
  return (
    <div className={cn(
      'text-ui w-[26px] h-[26px] flex items-center justify-center rounded-sm',
      isWin
        ? 'bg-win-subtle border border-win-ring text-win'
        : 'bg-loss-subtle border border-loss-ring text-loss'
    )}>
      {isWin ? 'W' : 'L'}
    </div>
  )
}
```

---

## Token naming conventions

| Token type    | Pattern                        | Example                          |
|---------------|--------------------------------|----------------------------------|
| Background    | `bg-{level}`                   | `bg-bg-base`, `bg-bg-surface`    |
| Card surface  | `bg-card`, `bg-card-raised`    | `bg-card`, `border-card-border`  |
| Accent        | `*-accent`, `*-accent-fill`    | `text-accent`, `bg-accent-fill`  |
| Text          | `text-{1,2,3}`                 | `text-text-1`, `text-text-2`     |
| Semantic      | `*-{win,loss,gold}{,-subtle,-ring}` | `text-win`, `bg-loss-subtle` |
| Mana          | `bg-mana-{w,u,b,r,g}`         | `bg-mana-u`, `bg-mana-b`         |
| Font          | `font-{display,body,data}`     | `font-display`, `font-data`      |
| Typography    | `text-{elo,stat,delta,...}`    | `text-elo`, `text-label`         |
| Radius        | `rounded-{sm,md,lg,xl,full}`   | `rounded-lg`, `rounded-full`     |

---

## `tokens.ts` helpers

```ts
import { colors, manaColors, getColorIdentityGradient, getRankTier } from '@/app/_design-system'

// Inline style for chart libraries, dynamic gradients
getColorIdentityGradient(['U', 'B'])
// → 'linear-gradient(160deg, #081428, #14082a)'

getRankTier(1847)
// → 'Diamond'

// Raw hex for Recharts, Chart.js etc.
colors.win       // '#44c070'
colors.accent    // '#aa28d8'
```