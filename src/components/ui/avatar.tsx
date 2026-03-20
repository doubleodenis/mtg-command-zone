"use client";

import * as React from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-2xs",
  sm: "h-7 w-7 text-xs",
  md: "h-avatar w-avatar text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function Avatar({ src, alt = "", fallback, size = "md", className }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden",
        "bg-card border border-card-border",
        "flex items-center justify-center",
        "font-display font-medium text-text-2",
        sizeClasses[size],
        className
      )}
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
