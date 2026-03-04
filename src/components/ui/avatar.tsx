import * as React from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function Avatar({ src, alt = "", fallback, size = "md", className }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-surface border border-surface-border flex items-center justify-center font-medium text-foreground-muted",
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
