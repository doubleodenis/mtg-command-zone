import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md px-4 py-2",
          "bg-card border border-card-border",
          "text-base text-text-1 placeholder:text-text-2",
          "transition-colors duration-150",
          "hover:border-card-border-hi",
          "focus:outline-none focus:border-accent-ring focus:ring-1 focus:ring-accent-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
