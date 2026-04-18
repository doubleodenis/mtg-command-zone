"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// ============================================
// Calendar Types
// ============================================

interface CalendarProps {
  /** Currently selected date */
  selected?: Date;
  /** Callback when a date is selected */
  onSelect?: (date: Date) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Additional className for the container */
  className?: string;
}

// ============================================
// Date Utilities
// ============================================

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateDisabled(date: Date, minDate?: Date, maxDate?: Date): boolean {
  if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
    return true;
  }
  if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
    return true;
  }
  return false;
}

// ============================================
// Calendar Component
// ============================================

export function Calendar({
  selected,
  onSelect,
  minDate,
  maxDate,
  className,
}: CalendarProps) {
  // Start with selected date's month, or current month
  const [viewDate, setViewDate] = React.useState(() => {
    const date = selected ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  // Generate calendar grid
  const days: (number | null)[] = [];
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  // Navigation handlers
  const goToPreviousMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelect?.(today);
  };

  // Check if previous/next month navigation should be disabled
  const canGoPrevious = !minDate || new Date(year, month - 1, getDaysInMonth(year, month - 1)) >= minDate;
  const canGoNext = !maxDate || new Date(year, month + 1, 1) <= maxDate;

  return (
    <div className={cn("w-56 select-none", className)}>
      {/* Header with month/year and navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={!canGoPrevious}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-1">
            {MONTHS[month]} {year}
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((day) => (
          <div
            key={day}
            className="h-6 flex items-center justify-center text-[10px] font-medium text-text-3"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-7" />;
          }

          const date = new Date(year, month, day);
          const isSelected = selected && isSameDay(date, selected);
          const isToday = isSameDay(date, today);
          const isDisabled = isDateDisabled(date, minDate, maxDate);

          return (
            <button
              key={day}
              type="button"
              onClick={() => !isDisabled && onSelect?.(date)}
              disabled={isDisabled}
              className={cn(
                "h-7 w-7 rounded text-xs font-medium transition-colors",
                "flex items-center justify-center",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                isDisabled && "opacity-30 cursor-not-allowed",
                !isDisabled && !isSelected && "hover:bg-bg-overlay",
                isSelected && "bg-accent-fill text-white",
                !isSelected && isToday && "border border-accent-ring text-accent",
                !isSelected && !isToday && "text-text-1"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-2 pt-2 border-t border-card-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goToToday}
          className="w-full text-xs h-7"
        >
          Today
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
