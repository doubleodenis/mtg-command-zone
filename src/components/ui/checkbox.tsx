"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Checkbox({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  id,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "h-5 w-5 shrink-0 rounded border border-line-1 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-accent border-accent text-white"
          : "bg-bg-2 hover:border-text-2",
        className
      )}
    >
      {checked && (
        <svg
          className="h-full w-full fill-current text-white"
          viewBox="0 0 24 24"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      )}
    </button>
  );
}
