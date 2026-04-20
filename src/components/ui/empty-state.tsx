"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Layers, FolderOpen, UserPlus, Search, Bell, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeInUp, duration } from "@/lib/motion";

type EmptyStateProps = {
  /**
   * Icon to display (typically an SVG component)
   */
  icon?: React.ReactNode;
  /**
   * Main heading text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Action button or link
   */
  action?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Disable entrance animation
   * @default false
   */
  noAnimation?: boolean;
};

const sizeClasses = {
  sm: {
    container: "py-6 px-4",
    icon: "w-8 h-8 mb-2",
    title: "text-sm",
    description: "text-xs",
  },
  md: {
    container: "py-10 px-6",
    icon: "w-12 h-12 mb-3",
    title: "text-base",
    description: "text-sm",
  },
  lg: {
    container: "py-16 px-8",
    icon: "w-16 h-16 mb-4",
    title: "text-lg",
    description: "text-base",
  },
};

/**
 * Empty state component for views with no data.
 * Use to communicate that a list/section is empty and guide users to take action.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
  noAnimation = false,
}: EmptyStateProps) {
  const sizes = sizeClasses[size];
  const shouldReduceMotion = useReducedMotion();
  const skipAnimation = noAnimation || shouldReduceMotion;

  const Container = skipAnimation ? "div" : motion.div;
  const containerProps = skipAnimation 
    ? {} 
    : {
        initial: "hidden",
        animate: "visible",
        variants: fadeInUp,
      };

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
      {...containerProps}
    >
      {icon && (
        <motion.div 
          className={cn("text-text-3", sizes.icon)}
          {...(skipAnimation ? {} : {
            initial: { opacity: 0, scale: 0.8 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: duration.normal, delay: 0.1 },
          })}
        >
          {icon}
        </motion.div>
      )}
      <h3 className={cn("font-display font-semibold text-text-1 mb-1", sizes.title)}>
        {title}
      </h3>
      {description && (
        <p className={cn("text-text-2 max-w-sm mb-4", sizes.description)}>
          {description}
        </p>
      )}
      {action && (
        <motion.div 
          className="mt-2"
          {...(skipAnimation ? {} : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: duration.normal, delay: 0.2 },
          })}
        >
          {action}
        </motion.div>
      )}
    </Container>
  );
}

// ─────────────────────────────────────────
// Preset Empty State Icons (using lucide-react)
// ─────────────────────────────────────────

function IconMatches({ className }: { className?: string }) {
  return <Users className={className} />;
}

function IconDecks({ className }: { className?: string }) {
  return <Layers className={className} />;
}

function IconCollections({ className }: { className?: string }) {
  return <FolderOpen className={className} />;
}

function IconFriends({ className }: { className?: string }) {
  return <UserPlus className={className} />;
}

function IconSearch({ className }: { className?: string }) {
  return <Search className={className} />;
}

function IconNotifications({ className }: { className?: string }) {
  return <Bell className={className} />;
}

function IconChart({ className }: { className?: string }) {
  return <BarChart3 className={className} />;
}

export {
  EmptyState,
  // Icons for empty states
  IconMatches,
  IconDecks,
  IconCollections,
  IconFriends,
  IconSearch,
  IconNotifications,
  IconChart,
  type EmptyStateProps,
};
