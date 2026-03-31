import Link from "next/link";
import { Button } from "@/components/ui/button";

function Icon404({ className }: { className?: string }) {
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
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 text-text-3">
          <Icon404 className="w-full h-full" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-text-1">
            Page not found
          </h1>
          <p className="text-text-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/matches">View matches</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
