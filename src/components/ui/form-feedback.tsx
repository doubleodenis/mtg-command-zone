"use client";

import * as React from "react";
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
      <ErrorIcon className={cn("shrink-0 mt-0.5", size === "sm" ? "w-3 h-3" : "w-4 h-4")} />
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
          <ErrorIcon className="w-5 h-5 text-loss" />
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
            <CloseIcon className="w-4 h-4" />
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
          <CheckIcon className="w-5 h-5 text-gain" />
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
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Icons
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
      />
    </svg>
  );
}

export { ErrorIcon, CheckIcon, CloseIcon };
