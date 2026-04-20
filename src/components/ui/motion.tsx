"use client";

/**
 * Motion wrapper components
 *
 * Reusable animated containers using Framer Motion with
 * automatic reduced-motion support via CSS.
 */

import * as React from "react";
import { motion, HTMLMotionProps, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  fadeIn,
  fadeInUp,
  scaleIn,
  staggerContainer,
  staggerContainerFast,
  staggerItem,
  staggerItemScale,
  cardEntrance,
  cardHover,
  buttonTap,
} from "@/lib/motion";

/* ─────────────────────────────────────────
   FADE IN
   Simple fade entrance wrapper
───────────────────────────────────────── */

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeIn({ children, className, delay = 0, ...props }: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeIn}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   FADE IN UP
   Fade + slide up entrance
───────────────────────────────────────── */

interface FadeInUpProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeInUp({ children, className, delay = 0, ...props }: FadeInUpProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeInUp}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   SCALE IN
   Scale + fade entrance
───────────────────────────────────────── */

interface ScaleInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScaleIn({ children, className, delay = 0, ...props }: ScaleInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={scaleIn}
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MOTION LIST
   Staggered children entrance animation
───────────────────────────────────────── */

interface MotionListProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  /** Faster stagger timing for dense lists */
  fast?: boolean;
}

export function MotionList({ children, className, fast = false, ...props }: MotionListProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fast ? staggerContainerFast : staggerContainer}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MOTION LIST ITEM
   Use inside MotionList for staggered effect
───────────────────────────────────────── */

interface MotionListItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  /** Use scale animation instead of slide */
  scale?: boolean;
}

export function MotionListItem({ children, className, scale = false, ...props }: MotionListItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={scale ? staggerItemScale : staggerItem}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MOTION CARD
   Animated Card with entrance and hover effects
───────────────────────────────────────── */

interface MotionCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  /** Enable hover lift effect */
  hover?: boolean;
  /** Delay before entrance animation */
  delay?: number;
}

export function MotionCard({
  children,
  className,
  hover = true,
  delay = 0,
  ...props
}: MotionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={cn("rounded-lg bg-card border border-card-border", className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileHover={hover ? "hover" : undefined}
      variants={{
        hidden: cardEntrance.hidden,
        visible: {
          ...cardEntrance.visible,
          transition: {
            ...(cardEntrance.visible as { transition: object }).transition,
            delay,
          },
        },
        hover: cardHover.hover,
      }}
      className={cn(
        "rounded-lg bg-card border border-card-border",
        hover && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   MOTION BUTTON
   Button with tap animation
───────────────────────────────────────── */

interface MotionButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function MotionButton({ children, className, disabled, ...props }: MotionButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion || disabled) {
    return (
      <button className={className} disabled={disabled} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      whileTap={buttonTap}
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* ─────────────────────────────────────────
   HOVER GLOW
   Subtle accent glow on hover
───────────────────────────────────────── */

interface HoverGlowProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function HoverGlow({ children, className, ...props }: HoverGlowProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{
        boxShadow: "0 0 20px rgba(170, 40, 216, 0.25)",
        transition: { duration: 0.2 },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
