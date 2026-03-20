import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-fill text-text-1 shadow-[0_0_20px_rgba(136,24,200,0.3)] hover:bg-accent hover:shadow-[0_0_24px_rgba(170,40,216,0.4)]",
  secondary:
    "bg-card text-text-1 border border-card-border hover:bg-card-raised hover:border-card-border-hi",
  ghost:
    "bg-transparent text-text-2 hover:bg-bg-overlay hover:text-text-1",
  outline:
    "bg-transparent text-text-1 border border-card-border hover:bg-bg-overlay hover:border-card-border-hi",
  destructive:
    "bg-loss text-text-1 hover:bg-loss/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-base gap-2",
  lg: "h-12 px-6 text-lg gap-2.5",
  icon: "h-10 w-10",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "text-ui inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
