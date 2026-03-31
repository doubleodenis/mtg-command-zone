import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

/**
 * Main application shell layout.
 * Provides consistent structure with optional sidebar.
 */
export function AppShell({ children, sidebar, className }: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-bg-base", className)}>
      {sidebar ? (
        <div className="max-w-6xl mx-auto px-4 flex gap-8">
          {sidebar}
          <main className="flex-1 py-6 min-w-0">{children}</main>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header with title, description, and action buttons.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="font-display text-2xl font-bold text-text-1">{title}</h1>
        {description && (
          <p className="mt-1 text-text-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

interface SectionProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Content section with optional title and action.
 */
export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && <h2 className="text-label text-accent">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
