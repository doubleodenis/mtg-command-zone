/**
 * Framer Motion utilities and animation variants
 *
 * Provides consistent animation patterns across the app with
 * automatic reduced-motion support.
 */

import { Variants, Transition } from "framer-motion";

/* ─────────────────────────────────────────
   DURATION CONSTANTS
   Match CSS tokens for consistency
───────────────────────────────────────── */

export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
  slower: 0.5,
} as const;

/* ─────────────────────────────────────────
   EASING CURVES
───────────────────────────────────────── */

export const easing = {
  ease: [0.25, 0.1, 0.25, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

/* ─────────────────────────────────────────
   BASE TRANSITIONS
───────────────────────────────────────── */

export const transition = {
  fast: { duration: duration.fast, ease: easing.ease },
  normal: { duration: duration.normal, ease: easing.ease },
  slow: { duration: duration.slow, ease: easing.easeOut },
  spring: { duration: duration.slow, ease: easing.spring },
} satisfies Record<string, Transition>;

/* ─────────────────────────────────────────
   FADE VARIANTS
───────────────────────────────────────── */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transition.normal,
  },
  exit: {
    opacity: 0,
    transition: transition.fast,
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.normal,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: transition.fast,
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.normal,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: transition.fast,
  },
};

/* ─────────────────────────────────────────
   SCALE VARIANTS
───────────────────────────────────────── */

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transition.normal,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transition.fast,
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transition.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: transition.fast,
  },
};

/* ─────────────────────────────────────────
   CARD VARIANTS
   For hover interactions and entrance
───────────────────────────────────────── */

export const cardHover: Variants = {
  initial: {
    y: 0,
    boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
  },
  hover: {
    y: -2,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
    transition: transition.fast,
  },
};

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.slow,
  },
};

/* ─────────────────────────────────────────
   STAGGER VARIANTS
   For lists and grids
───────────────────────────────────────── */

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.normal,
  },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transition.normal,
  },
};

/* ─────────────────────────────────────────
   BUTTON VARIANTS
───────────────────────────────────────── */

export const buttonTap = {
  scale: 0.98,
  transition: { duration: duration.instant },
};

export const buttonHover = {
  scale: 1.02,
  transition: { duration: duration.fast },
};

/* ─────────────────────────────────────────
   UTILITY: Create stagger with custom timing
───────────────────────────────────────── */

export function createStaggerContainer(
  staggerDelay = 0.05,
  initialDelay = 0.1
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      },
    },
  };
}

export function createStaggerItem(yOffset = 12): Variants {
  return {
    hidden: { opacity: 0, y: yOffset },
    visible: {
      opacity: 1,
      y: 0,
      transition: transition.normal,
    },
  };
}

/* ─────────────────────────────────────────
   UTILITY: Delayed entrance
───────────────────────────────────────── */

export function createDelayedFadeIn(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        ...transition.normal,
        delay,
      },
    },
  };
}
