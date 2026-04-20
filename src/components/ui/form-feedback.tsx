"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FormErrorProps = {
  /** Error message to display */
  message?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
};

/**
 * Inline form error message component.
 * Use below form inputs to show validation errors.
 */
export function FormError({ message, className, size = "md" }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-loss",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <AlertCircle className={cn("shrink-0 mt-0.5", size === "sm" ? "w-3 h-3" : "w-4 h-4")} />
      <span>{message}</span>
    </div>
  );
}

type FormErrorBannerProps = {
  /** Error message to display */
  message?: string | null;
  /** Title for the error banner */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
};

/**
 * Banner-style form error for displaying at the top of forms.
 */
export function FormErrorBanner({
  message,
  title = "Error",
  className,
  onDismiss,
}: FormErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg bg-loss-subtle border border-loss-ring p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-loss" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-loss">{title}</h4>
          <p className="mt-1 text-sm text-loss/80">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-md text-loss/60 hover:text-loss hover:bg-loss/10 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

type FormSuccessBannerProps = {
  /** Success message to display */
  message?: string | null;
  /** Title for the success banner */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
};

/**
 * Banner-style success message for forms.
 */
export function FormSuccessBanner({
  message,
  title = "Success",
  className,
  onDismiss,
}: FormSuccessBannerProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      className={cn(
        "rounded-lg bg-gain-subtle border border-gain-ring p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5 text-gain" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gain">{title}</h4>
          <p className="mt-1 text-sm text-gain/80">{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-md text-gain/60 hover:text-gain hover:bg-gain/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export { AlertCircle as ErrorIcon, CheckCircle2 as CheckIcon, X as CloseIcon };
