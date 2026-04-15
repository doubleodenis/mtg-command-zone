"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconError } from "@/components/ui/error-boundary";

export default function LeaderboardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Leaderboards page error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="mx-auto w-12 h-12 text-loss">
          <IconError className="w-full h-full" />
        </div>
        <h2 className="text-lg font-display font-semibold text-text-1">
          Unable to load leaderboards
        </h2>
        <p className="text-text-2 text-sm">
          We couldn't load the leaderboards. Please try again in a moment.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="px-4 py-2 rounded-md bg-loss-subtle border border-loss-ring">
            <p className="text-xs font-data text-loss break-all">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={reset} variant="primary" size="sm">
            Try again
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
