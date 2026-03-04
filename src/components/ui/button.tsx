import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: "#a855f7",
    color: "#ffffff",
    boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)",
  },
  secondary: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#a1a1aa",
  },
  outline: {
    backgroundColor: "transparent",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  destructive: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
  },
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          {
            "h-10 px-4 py-2 text-sm": size === "default",
            "h-8 px-3 text-xs": size === "sm",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        style={{
          ...variantStyles[variant],
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
