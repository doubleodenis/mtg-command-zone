"use client";

import * as React from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

const sizeStyles: Record<string, { height: string; width: string; fontSize: string }> = {
  sm: { height: "2rem", width: "2rem", fontSize: "0.75rem" },
  md: { height: "2.5rem", width: "2.5rem", fontSize: "0.875rem" },
  lg: { height: "3.5rem", width: "3.5rem", fontSize: "1rem" },
  xl: { height: "5rem", width: "5rem", fontSize: "1.25rem" },
};

export function Avatar({ src, alt = "", fallback, size = "md", className, style }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-surface border border-surface-border flex items-center justify-center font-medium text-foreground-muted",
        sizeClasses[size],
        className
      )}
      style={{
        position: "relative",
        borderRadius: "9999px",
        overflow: "hidden",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        color: "#a1a1aa",
        ...sizeStyles[size],
        ...style,
      }}
    >
      {src && !imageError ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
