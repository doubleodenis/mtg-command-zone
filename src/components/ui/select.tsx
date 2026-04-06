"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

// ============================================
// Icons
// ============================================

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ============================================
// Component
// ============================================

/**
 * Custom select dropdown that matches the design system.
 * Replaces native <select> to have full styling control.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full h-8 text-sm rounded-md border px-2 text-left",
          "flex items-center justify-between gap-2",
          "transition-colors duration-150",
          selectedOption
            ? "bg-accent/10 border-accent/30 text-text-1"
            : "bg-card border-card-border text-text-2",
          !disabled && "hover:border-card-border-hi",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon
          className={cn(
            "w-4 h-4 shrink-0 text-text-2 transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50",
            "rounded-lg overflow-hidden",
            "bg-card-raised border border-accent/30 shadow-xl",
            "max-h-60 overflow-y-auto",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
          role="listbox"
        >
          {/* Placeholder option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={cn(
              "w-full px-3 py-2 text-sm text-left",
              "transition-colors",
              !value
                ? "bg-accent/15 text-text-1"
                : "text-text-2 hover:bg-accent/10 hover:text-text-1"
            )}
            role="option"
            aria-selected={!value}
          >
            {placeholder}
          </button>

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left",
                "transition-colors",
                value === option.value
                  ? "bg-accent/20 text-text-1"
                  : "text-text-1 hover:bg-accent/10"
              )}
              role="option"
              aria-selected={value === option.value}
            >
              {option.label}
            </button>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-3">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { SelectOption, SelectProps };
