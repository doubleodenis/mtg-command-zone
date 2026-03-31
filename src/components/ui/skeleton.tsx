import * as React from "react";
import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "circular" | "rectangular";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * The shape variant of the skeleton
   * @default "rectangular"
   */
  variant?: SkeletonVariant;
  /**
   * Width of the skeleton (CSS value)
   */
  width?: string | number;
  /**
   * Height of the skeleton (CSS value)
   */
  height?: string | number;
  /**
   * Whether to animate the skeleton
   * @default true
   */
  animate?: boolean;
};

const variantClasses: Record<SkeletonVariant, string> = {
  text: "rounded-sm h-4",
  circular: "rounded-full",
  rectangular: "rounded-md",
};

/**
 * Skeleton loading placeholder component.
 * Use to indicate content is loading while maintaining layout structure.
 */
function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  animate = true,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-bg-raised",
        animate && "animate-shimmer bg-gradient-to-r from-bg-raised via-bg-overlay to-bg-raised bg-[length:200%_100%]",
        variantClasses[variant],
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─────────────────────────────────────────
// Preset Skeleton Compositions
// ─────────────────────────────────────────

/**
 * Skeleton for avatar placeholders
 */
function SkeletonAvatar({ size = 28, className }: { size?: number; className?: string }) {
  return <Skeleton variant="circular" width={size} height={size} className={className} />;
}

/**
 * Skeleton for text lines
 */
function SkeletonText({ 
  lines = 1, 
  className,
  lastLineWidth = "60%",
}: { 
  lines?: number; 
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            i === lines - 1 && lines > 1 ? `w-[${lastLineWidth}]` : "w-full"
          )}
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for card content
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-card border border-card-border p-5", className)}>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/2" height={12} />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

/**
 * Skeleton for match card
 */
function SkeletonMatchCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-card border border-card-border p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" width={60} height={20} className="rounded-sm" />
          <Skeleton variant="rectangular" width={40} height={20} className="rounded-sm" />
        </div>
        <Skeleton variant="text" width={80} height={14} />
      </div>
      {/* Participants */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={26} height={26} className="rounded-sm" />
            <SkeletonAvatar size={28} />
            <Skeleton variant="text" className="flex-1 max-w-[120px]" />
            <Skeleton variant="text" width={50} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for stat card
 */
function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-card border border-card-border p-4", className)}>
      <Skeleton variant="text" width={80} height={12} className="mb-3" />
      <Skeleton variant="rectangular" width={100} height={32} className="mb-2" />
      <Skeleton variant="text" width={60} height={14} />
    </div>
  );
}

/**
 * Skeleton for profile header
 */
function SkeletonProfileHeader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <SkeletonAvatar size={64} />
      <div className="space-y-2">
        <Skeleton variant="text" width={160} height={24} />
        <Skeleton variant="text" width={100} height={14} />
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows
 */
function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  className,
}: { 
  rows?: number; 
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton 
              key={j} 
              variant="text" 
              className="flex-1" 
              height={16}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export { 
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  SkeletonCard,
  SkeletonMatchCard,
  SkeletonStatCard,
  SkeletonProfileHeader,
  SkeletonTable,
  type SkeletonVariant,
};
