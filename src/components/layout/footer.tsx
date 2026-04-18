import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-card-border bg-bg-surface">
      <div className="max-w-6xl md:mx-auto px-4 py-5 flex items-center justify-between gap-4">
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
