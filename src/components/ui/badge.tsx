import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "accent" | "win" | "loss" | "gold" | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Enable pulse animation for attention */
  pulse?: boolean;
  /** Enable entrance scale animation */
  animate?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-bg-overlay text-text-2 border-transparent",
  accent: "bg-accent-dim text-accent border-accent-ring",
  win: "bg-win-subtle text-win border-win-ring",
  loss: "bg-loss-subtle text-loss border-loss-ring",
  gold: "bg-gold-subtle text-gold border-gold-ring",
  outline: "bg-transparent text-text-2 border-card-border",
};

export function Badge({ 
  className, 
  variant = "default", 
  pulse = false,
  animate = false,
  ...props 
}: BadgeProps) {
  return (
    <span
      className={cn(
        "text-ui inline-flex items-center rounded-md border px-2 py-0.5",
        "text-sm font-medium transition-colors",
        variantClasses[variant],
        pulse && "animate-glow-pulse",
        animate && "animate-scale-in",
        className
      )}
      {...props}
    />
  );
}
