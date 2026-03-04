import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "win" | "loss" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "bg-accent/20 text-accent": variant === "default",
          "bg-win/20 text-win": variant === "win",
          "bg-loss/20 text-loss": variant === "loss",
          "border border-surface-border text-foreground-muted": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
