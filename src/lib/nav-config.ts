import type { NavItem } from "@/components/layout";

/**
 * Main navigation items shown when logged in (personal dashboard)
 */
export const AUTHENTICATED_NAV: NavItem[] = [
  { label: "Overview", href: "/" },
  { label: "Matches", href: "/matches" },
  { label: "Decks", href: "/decks" },
  { label: "Collections", href: "/collections" },
  { label: "FAQ", href: "/faq" },
];

/**
 * Navigation items shown when logged out (global dashboard)
 */
export const PUBLIC_NAV: NavItem[] = [
  { label: "Overview", href: "/" },
  // HIDDEN: Global leaderboards disabled - uncomment to re-enable
  // { label: "Leaderboards", href: "/leaderboards" },
  { label: "FAQ", href: "/faq" },
];
