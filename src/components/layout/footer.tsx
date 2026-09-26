import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-card-border bg-bg-surface">
      {/* pr-16 keeps the right-aligned links clear of the fixed feedback
          trigger (44px wide at right-4), which would otherwise sit on top of
          "Privacy Policy" and swallow its clicks. Once the viewport is wide
          enough that the centred container's own right margin clears the
          trigger, the extra padding is unnecessary. */}
      <div className="max-w-6xl md:mx-auto pl-4 pr-16 xl:pr-4 py-5 flex items-center justify-between gap-4">
        <p className="text-xs text-text-2">© {new Date().getFullYear()} CommandZone</p>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/faq" className="text-text-2 hover:text-text-1 transition-colors">
            FAQ
          </Link>
          <Link
            href="/privacy-policy"
            className="text-text-2 hover:text-text-1 transition-colors"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
