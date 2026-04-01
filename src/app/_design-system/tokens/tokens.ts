/**
 * TypeScript mirror of the design token system.
 * Use these for:
 *   - Inline styles where Tailwind classes can't reach
 *   - Dynamic color logic (e.g. picking mana pip color from a string)
 *   - Chart libraries (Recharts, Chart.js) that need raw hex values
 *   - Tests / Storybook
 *
 * !Keep in sync with theme.css.
 */

/* ─────────────────────────────────────────
   COLORS
───────────────────────────────────────── */

export const colors = {
  /* Backgrounds */
  bgBase:     '#04060d',
  bgSurface:  '#090c18',
  bgRaised:   '#0e1222',
  bgOverlay:  '#151c30',

  /* Card surfaces */
  card:          '#0f0f12',
  cardRaised:    '#141417',
  cardBorder:    '#222228',
  cardBorderHi:  '#2e2e38',

  /* Accent — Phyrexian Purple */
  accent:       '#aa28d8',
  accentFill:   '#8818c8',
  accentDim:    'rgba(170, 40, 216, 0.13)',
  accentRing:   'rgba(170, 40, 216, 0.32)',

  /* Text */
  text1: '#dde8ff',
  text2: '#8b909c',
  text3: '#4a4d55',

  /* Semantic */
  win:       '#44c070',
  winSubtle: 'rgba(68, 192, 112, 0.10)',
  winRing:   'rgba(68, 192, 112, 0.25)',

  loss:       '#e05555',
  lossSubtle: 'rgba(224, 85, 85, 0.10)',
  lossRing:   'rgba(224, 85, 85, 0.25)',

  gold:       '#d4a843',
  goldSubtle: 'rgba(212, 168, 67, 0.10)',
  goldRing:   'rgba(212, 168, 67, 0.25)',
} as const

/* ─────────────────────────────────────────
   MANA COLORS
───────────────────────────────────────── */

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G'

export const manaColors: Record<ManaColor, { bg: string; border: string }> = {
  W: { bg: '#c8bf90', border: '#a09860' },
  U: { bg: '#3060b8', border: '#4878d0' },
  B: { bg: '#221830', border: '#3a2458' },
  R: { bg: '#9a1a08', border: '#c02818' },
  G: { bg: '#1a5018', border: '#227022' },
}

/**
 * Returns the background gradient CSS string for a given color identity.
 * Used for commander art block placeholders before Scryfall art loads.
 *
 * @example
 * getColorIdentityGradient(['U', 'B'])
 * // → 'linear-gradient(160deg, #081428, #14082a)'
 */
export function getColorIdentityGradient(identity: ManaColor[]): string {
  if (identity.length === 0) return `linear-gradient(160deg, #141417, #0f0f12)`

  const stops = identity.map((c) => {
    const mapping: Record<ManaColor, [string, string]> = {
      W: ['#201c14', '#181410'],
      U: ['#081428', '#0a1440'],
      B: ['#100818', '#0c0614'],
      R: ['#1c0808', '#140606'],
      G: ['#071407', '#0a1a0a'],
    }
    return mapping[c]
  })

  if (stops.length === 1) {
    return `linear-gradient(160deg, ${stops[0][0]}, ${stops[0][1]})`
  }

  // Multi-color: blend from first to last
  const start = stops[0][0]
  const end   = stops[stops.length - 1][1]
  const mids  = stops.slice(1, -1).map((s) => s[0]).join(', ')
  const parts = [start, mids, end].filter(Boolean).join(', ')
  return `linear-gradient(160deg, ${parts})`
}

/* ─────────────────────────────────────────
   RANK TIERS
───────────────────────────────────────── */

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Mythic'

export const rankColors: Record<RankTier, { color: string; bg: string; border: string }> = {
  Bronze:   { color: '#8a7a60', bg: 'rgba(138,122,96,0.10)',  border: 'rgba(138,122,96,0.25)'  },
  Silver:   { color: '#8090b0', bg: 'rgba(128,144,176,0.10)', border: 'rgba(128,144,176,0.25)' },
  Gold:     { color: '#d4a843', bg: 'rgba(212,168,67,0.10)',  border: 'rgba(212,168,67,0.25)'  },
  Platinum: { color: '#6aaae8', bg: 'rgba(106,170,232,0.10)', border: 'rgba(106,170,232,0.25)' },
  Diamond:  { color: '#aa28d8', bg: 'rgba(170,40,216,0.10)',  border: 'rgba(170,40,216,0.25)'  },
  Mythic:   { color: '#e05580', bg: 'rgba(224,85,128,0.10)',  border: 'rgba(224,85,128,0.25)'  },
}

/**
 * Returns the rank tier for a given ELO rating.
 * Adjust thresholds to taste.
 */
export function getRankTier(elo: number): RankTier {
  if (elo >= 2000) return 'Mythic'
  if (elo >= 1800) return 'Diamond'
  if (elo >= 1600) return 'Platinum'
  if (elo >= 1400) return 'Gold'
  if (elo >= 1200) return 'Silver'
  return 'Bronze'
}

/* ─────────────────────────────────────────
   TYPOGRAPHY
───────────────────────────────────────── */

export const fonts = {
  display: 'var(--font-display)',  // Chakra Petch
  body:    'var(--font-body)',     // Barlow
  data:    'var(--font-data)',     // JetBrains Mono
} as const

/* ─────────────────────────────────────────
   SPACING
───────────────────────────────────────── */

export const spacing = {
  pip:       9,   // px — mana pip diameter
  topbar:    48,  // px — topbar height
  avatar:    28,  // px — user avatar
  wlBadge:   26,  // px — W/L badge
  cmdArt:    56,  // px — commander block art height
  cmdBlock:  64,  // px — commander block width
} as const