"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

interface SidebarProps {
  items: NavItem[];
  className?: string;
}

/**
 * Vertical sidebar navigation for dashboard views.
 * Highlights the active route automatically.
 */
export function Sidebar({ items, className }: SidebarProps) {
  const pathname = usePathname();

  // Find the most specific matching item (longest href that matches)
  const activeHref = items
    .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className={cn("w-56 shrink-0", className)}>
      <nav className="flex flex-col gap-1 py-4">
        {items.map((item) => {
          const isActive = item.href === activeHref;
          
          return (
            <SidebarLink
              key={item.href}
              href={item.href}
              isActive={isActive}
              icon={item.icon}
            >
              {item.label}
            </SidebarLink>
          );
        })}
      </nav>
    </aside>
  );
}

interface SidebarLinkProps {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
  icon?: React.ReactNode;
}

function SidebarLink({ href, children, isActive, icon }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "text-ui flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        isActive
          ? "bg-accent-dim text-accent border-l-2 border-accent"
          : "text-text-2 hover:text-text-1 hover:bg-bg-overlay"
      )}
    >
      {icon && <span className="w-5 h-5 flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </Link>
  );
}

interface TabNavProps {
  items: NavItem[];
  className?: string;
}

/**
 * Horizontal tab navigation for sub-sections.
 * Used below the main navbar for dashboard sections.
 */
export function TabNav({ items, className }: TabNavProps) {
  const pathname = usePathname();

  // Find the most specific matching item (longest href that matches)
  const activeHref = items
    .filter(item => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className={cn("sticky top-0 z-10 border-b border-card-border bg-bg-surface", className)}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-6 overflow-x-auto scrollbar-hide">
          {items.map((item) => {
            const isActive = item.href === activeHref;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-ui py-3 whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "text-accent border-accent"
                    : "text-text-2 border-transparent hover:text-text-1 hover:border-card-border-hi"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
