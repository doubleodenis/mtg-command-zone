"use client";

/**
 * AnimatedNumber - Animated counter component using Framer Motion
 * 
 * Provides smooth counting animations for numbers transitioning
 * from one value to another. Respects reduced motion preferences.
 */

import * as React from "react";
import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  /** The target number to animate to */
  value: number;
  /** Number of decimal places to show */
  decimals?: number;
  /** Format with locale separators (e.g., 1,234) */
  formatLocale?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Prefix to display before the number (e.g., "$", "+") */
  prefix?: string;
  /** Suffix to display after the number (e.g., "%", "pts") */
  suffix?: string;
}

/**
 * Animates a number from 0 (or previous value) to the target value.
 * 
 * @example
 * ```tsx
 * <AnimatedNumber value={1847} className="text-4xl font-bold" />
 * <AnimatedNumber value={18} prefix="+" className="text-win" />
 * <AnimatedNumber value={95.5} suffix="%" decimals={1} />
 * ```
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  formatLocale = true,
  className,
  prefix = "",
  suffix = "",
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasAnimated = React.useRef(false);
  
  // Use spring for smooth animation - starts at 0, animates to value
  // Lower stiffness = slower animation, higher damping = less bounce
  const spring = useSpring(0, {
    stiffness: 30,
    damping: 15,
    mass: 1,
  });

  // Transform spring value to formatted display string
  const display = useTransform(spring, (current) => {
    const rounded = decimals > 0 
      ? current.toFixed(decimals)
      : Math.round(current);
    
    if (formatLocale && decimals === 0) {
      return Number(rounded).toLocaleString();
    }
    return String(rounded);
  });

  // Animate to target value when it changes
  // Use a small delay on first mount to ensure animation is visible
  React.useEffect(() => {
    if (shouldReduceMotion) {
      spring.jump(value);
      return;
    }

    if (!hasAnimated.current) {
      // First mount - delay slightly so user sees the count-up
      const timeout = setTimeout(() => {
        spring.set(value);
      }, 100);
      hasAnimated.current = true;
      return () => clearTimeout(timeout);
    } else {
      // Subsequent value changes animate immediately
      spring.set(value);
    }
  }, [spring, value, shouldReduceMotion]);

  // For reduced motion, show static value
  if (shouldReduceMotion) {
    const formattedValue = formatLocale 
      ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : decimals > 0 ? value.toFixed(decimals) : String(value);
    
    return (
      <span className={cn("tabular-nums", className)}>
        {prefix}{formattedValue}{suffix}
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

/**
 * AnimatedRating - Specialized animated number for ELO/rating values
 * 
 * Includes optional delta display with color coding.
 */
interface AnimatedRatingProps {
  /** Current rating value */
  rating: number;
  /** Optional rating change (delta) */
  delta?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "hero";
  /** Enable counting animation */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const ratingSizeClasses = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-stat",
  hero: "text-elo",
};

const deltaSizeClasses = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-delta",
  hero: "text-lg",
};

export function AnimatedRating({
  rating,
  delta,
  size = "md",
  animate: shouldAnimate = true,
  className,
}: AnimatedRatingProps) {
  const shouldReduceMotion = useReducedMotion();
  const skipAnimation = !shouldAnimate || shouldReduceMotion;

  return (
    <div className={cn("inline-flex items-baseline gap-2", className)}>
      {skipAnimation ? (
        <span
          className={cn(
            "font-display font-bold tabular-nums text-text-1",
            ratingSizeClasses[size]
          )}
        >
          {rating.toLocaleString()}
        </span>
      ) : (
        <AnimatedNumber
          value={rating}
          className={cn(
            "font-display font-bold text-text-1",
            ratingSizeClasses[size]
          )}
        />
      )}
      
      {delta !== undefined && delta !== 0 && (
        <span
          className={cn(
            "font-display font-bold tabular-nums",
            deltaSizeClasses[size],
            delta > 0 && "text-win",
            delta < 0 && "text-loss"
          )}
        >
          {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
        </span>
      )}
    </div>
  );
}
