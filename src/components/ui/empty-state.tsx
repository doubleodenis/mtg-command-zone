import * as React from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /**
   * Icon to display (typically an SVG component)
   */
  icon?: React.ReactNode;
  /**
   * Main heading text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Action button or link
   */
  action?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
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

/**
 * Empty state component for views with no data.
 * Use to communicate that a list/section is empty and guide users to take action.
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizes.container,
        className
      )}
    >
      {icon && (
        <div className={cn("text-text-3", sizes.icon)}>
          {icon}
        </div>
      )}
      <h3 className={cn("font-display font-semibold text-text-1 mb-1", sizes.title)}>
        {title}
      </h3>
      {description && (
        <p className={cn("text-text-2 max-w-sm mb-4", sizes.description)}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────
// Preset Empty State Icons (inline SVGs)
// ─────────────────────────────────────────

function IconMatches({ className }: { className?: string }) {
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
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" 
      />
    </svg>
  );
}

function IconDecks({ className }: { className?: string }) {
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
        d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" 
      />
    </svg>
  );
}

function IconCollections({ className }: { className?: string }) {
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
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" 
      />
    </svg>
  );
}

function IconFriends({ className }: { className?: string }) {
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
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" 
      />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" 
      />
    </svg>
  );
}

function IconNotifications({ className }: { className?: string }) {
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
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" 
      />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
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
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" 
      />
    </svg>
  );
}

export {
  EmptyState,
  // Icons for empty states
  IconMatches,
  IconDecks,
  IconCollections,
  IconFriends,
  IconSearch,
  IconNotifications,
  IconChart,
  type EmptyStateProps,
};
