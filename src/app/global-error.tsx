"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 text-loss">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-text-1">
              Something went wrong
            </h1>
            <p className="text-text-2">
              We encountered an unexpected error. Our team has been notified
              and is working to fix it.
            </p>
          </div>

          {/* Error Details (dev only) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="px-4 py-3 rounded-lg bg-loss-subtle border border-loss-ring text-left">
              <p className="text-xs font-data text-loss break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-text-3 mt-1">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="primary">
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="ghost"
            >
              Go home
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
