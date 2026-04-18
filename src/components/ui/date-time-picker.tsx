"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { Button } from "./button";

// ============================================
// DateTimePicker Types
// ============================================

interface DateTimePickerProps {
  /** Current value as ISO string or Date */
  value?: string | Date;
  /** Callback when value changes (returns ISO string) */
  onChange?: (value: string) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date (defaults to now) */
  maxDate?: Date;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional className for the trigger button */
  className?: string;
}

// ============================================
// Date/Time Utilities
// ============================================

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

// ============================================
// DateTimePicker Component
// ============================================

export function DateTimePicker({
  value,
  onChange,
  minDate,
  maxDate = new Date(),
  placeholder = "Select date and time",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Parse the current value into a Date object
  const currentDate = React.useMemo(() => {
    if (!value) return undefined;
    const date = typeof value === "string" ? new Date(value) : value;
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  // Local state for time input
  const [timeValue, setTimeValue] = React.useState(() => {
    return currentDate ? formatTime(currentDate) : formatTime(new Date());
  });

  // Update time value when currentDate changes
  React.useEffect(() => {
    if (currentDate) {
      setTimeValue(formatTime(currentDate));
    }
  }, [currentDate]);

  // Handle date selection from calendar
  const handleDateSelect = (date: Date) => {
    const { hours, minutes } = parseTimeString(timeValue);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    
    // Ensure we don't exceed maxDate
    if (maxDate && newDate > maxDate) {
      newDate.setHours(maxDate.getHours(), maxDate.getMinutes(), 0, 0);
      setTimeValue(formatTime(maxDate));
    }
    
    onChange?.(newDate.toISOString());
  };

  // Handle time change
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);

    if (currentDate && newTime) {
      const { hours, minutes } = parseTimeString(newTime);
      const newDate = new Date(currentDate);
      newDate.setHours(hours, minutes, 0, 0);
      
      // Ensure we don't exceed maxDate
      if (maxDate && newDate > maxDate) {
        return; // Don't update if it would exceed maxDate
      }
      
      onChange?.(newDate.toISOString());
    }
  };

  // Quick time presets
  const setToNow = () => {
    const now = new Date();
    setTimeValue(formatTime(now));
    onChange?.(now.toISOString());
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !currentDate && "text-text-2",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {currentDate ? formatDateTime(currentDate) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* Calendar */}
          <Calendar
            selected={currentDate}
            onSelect={handleDateSelect}
            minDate={minDate}
            maxDate={maxDate}
          />

          {/* Time picker */}
          <div className="mt-2 pt-2 border-t border-card-border">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-1 shrink-0">
                Time
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                className={cn(
                  "flex-1 h-7 px-2 rounded text-xs",
                  "bg-bg-surface border border-card-border",
                  "text-text-1",
                  "focus:outline-none focus:border-accent-ring focus:ring-1 focus:ring-accent-ring"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={setToNow}
                className="shrink-0 text-xs h-7 px-2"
              >
                Now
              </Button>
            </div>
          </div>

          {/* Done button */}
          <div className="mt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="w-full h-7 text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// Icons
// ============================================

function CalendarIcon({ className }: { className?: string }) {
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
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}
