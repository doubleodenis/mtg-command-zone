"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /**
   * Custom fallback UI to render when an error occurs.
   * If not provided, uses the default ErrorFallback.
   */
  fallback?: React.ReactNode;
  /**
   * Callback when an error is caught
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * Callback to reset the error state
   */
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error Boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.reset}
        />
      );
    }

    return this.props.children;
  }
}

// ─────────────────────────────────────────
// Error Fallback Components
// ─────────────────────────────────────────

type ErrorFallbackProps = {
  error?: Error | null;
  onReset?: () => void;
  className?: string;
  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show technical details (error message)
   * @default false in production
   */
  showDetails?: boolean;
};

const sizeClasses = {
  sm: {
    container: "py-6 px-4",
    icon: "w-8 h-8 mb-2",
    title: "text-sm",
    description: "text-xs",
  },
  md: {
    container: "py-10 px-6",
    icon: "w-12 h-12 mb-3",
    title: "text-base",
    description: "text-sm",
  },
  lg: {
    container: "py-16 px-8",
    icon: "w-16 h-16 mb-4",
    title: "text-lg",
    description: "text-base",
  },
};

function IconError({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" 
      />
    </svg>
  );
}

/**
 * Default error fallback UI.
 * Can be used standalone or as the default for ErrorBoundary.
 */
function ErrorFallback({
  error,
  onReset,
  className,
  size = "md",
  showDetails = process.env.NODE_ENV === "development",
}: ErrorFallbackProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
      role="alert"
    >
      <div className={cn("text-loss", sizes.icon)}>
        <IconError className="w-full h-full" />
      </div>
      <h3 className={cn("font-display font-semibold text-text-1 mb-1", sizes.title)}>
        Something went wrong
      </h3>
      <p className={cn("text-text-2 max-w-sm mb-4", sizes.description)}>
        An unexpected error occurred. Please try again.
      </p>
      {showDetails && error && (
        <div className="mb-4 px-4 py-2 rounded-md bg-loss-subtle border border-loss-ring max-w-md">
          <p className="text-xs font-data text-loss break-all">
            {error.message}
          </p>
        </div>
      )}
      {onReset && (
        <Button onClick={onReset} variant="secondary" size="sm">
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Error fallback for card-level errors (smaller, inline)
 */
function ErrorFallbackCard({ 
  error: _error,
  onReset,
  className,
}: { 
  error?: Error | null;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card border border-loss-ring p-4 text-center",
        className
      )}
      role="alert"
    >
      <div className="flex items-center justify-center gap-2 text-loss mb-2">
        <IconError className="w-4 h-4" />
        <span className="text-sm font-medium">Error loading content</span>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="text-xs text-text-2 hover:text-text-1 underline transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Error fallback for inline/text-level errors (minimal)
 */
function ErrorFallbackInline({
  message = "Error loading content",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <span className={cn("text-loss text-sm", className)}>
      {message}
    </span>
  );
}

// ─────────────────────────────────────────
// Page-level Error UI (for Next.js error.tsx)
// ─────────────────────────────────────────

type PageErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Full-page error UI for Next.js error.tsx files.
 */
function PageError({ error, reset }: PageErrorProps) {
  React.useEffect(() => {
    // Log error to console/reporting service
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <ErrorFallback
        error={error}
        onReset={reset}
        size="lg"
        showDetails={process.env.NODE_ENV === "development"}
      />
    </div>
  );
}

export {
  ErrorBoundary,
  ErrorFallback,
  ErrorFallbackCard,
  ErrorFallbackInline,
  PageError,
  IconError,
  type ErrorBoundaryProps,
  type ErrorFallbackProps,
  type PageErrorProps,
};
