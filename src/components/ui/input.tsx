import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border px-4 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        style={{
          backgroundColor: "rgba(18, 18, 26, 0.9)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          color: "#ffffff",
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
