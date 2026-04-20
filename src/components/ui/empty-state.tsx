import * as React from "react";
import { Users, Layers, FolderOpen, UserPlus, Search, Bell, BarChart3 } from "lucide-react";
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
// Preset Empty State Icons (using lucide-react)
// ─────────────────────────────────────────

function IconMatches({ className }: { className?: string }) {
  return <Users className={className} />;
}

function IconDecks({ className }: { className?: string }) {
  return <Layers className={className} />;
}

function IconCollections({ className }: { className?: string }) {
  return <FolderOpen className={className} />;
}

function IconFriends({ className }: { className?: string }) {
  return <UserPlus className={className} />;
}

function IconSearch({ className }: { className?: string }) {
  return <Search className={className} />;
}

function IconNotifications({ className }: { className?: string }) {
  return <Bell className={className} />;
}

function IconChart({ className }: { className?: string }) {
  return <BarChart3 className={className} />;
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
