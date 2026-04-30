"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SubNavItem = {
  label: string;
  href: string;
};

interface SubNavProps {
  items: SubNavItem[];
  className?: string;
}

/**
 * Secondary horizontal navigation for nested views.
 * Underline-style tabs with scroll fade mask for mobile.
 * Visually subordinate to main TabNav (pill style).
 */
export function SubNav({ items, className }: SubNavProps) {
  const pathname = usePathname();

  // Find the most specific matching item (longest href that matches)
  const activeHref = items
    .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className={cn("relative", className)}>
      {/* Nav container with bottom border */}
      <div className="border-b border-card-border">
        <nav className="flex gap-2 overflow-x-auto scrollbar-hide -mb-px pr-8 md:pr-0">
          {items.map((item) => {
            const isActive = item.href === activeHref;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-ui px-3 py-2.5 whitespace-nowrap border-b-2 transition-colors shrink-0",
                  isActive
                    ? "text-accent border-accent"
                    : "text-text-2 border-transparent hover:text-text-1 hover:border-card-border-hi"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Fade mask to hint at scrollability - wider gradient for smoother effect */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none md:hidden"
        style={{
          background: "linear-gradient(to left, var(--color-bg-base) 0%, var(--color-bg-base) 25%, transparent 100%)"
        }}
      />
    </div>
  );
}
