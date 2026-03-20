import { cn } from "@/lib/utils";
import type { ManaColor } from "@/app/_design-system";

interface ManaPipProps {
  color: ManaColor;
  size?: "sm" | "md";
  className?: string;
}

const colorClasses: Record<ManaColor, string> = {
  W: "bg-mana-w border-mana-w-border",
  U: "bg-mana-u border-mana-u-border",
  B: "bg-mana-b border-mana-b-border",
  R: "bg-mana-r border-mana-r-border",
  G: "bg-mana-g border-mana-g-border",
};

const colorLabels: Record<ManaColor, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

/**
 * Single mana pip for color identity display.
 * Standard size is 9x9px per design system convention.
 */
export function ManaPip({ color, size = "md", className }: ManaPipProps) {
  const sizeClasses = {
    sm: "h-1.5 w-1.5",    // 6px
    md: "h-pip w-pip",     // 9px
  };

  return (
    <span
      className={cn(
        "rounded-full border shrink-0",
        colorClasses[color],
        sizeClasses[size],
        className
      )}
      title={colorLabels[color]}
      aria-label={colorLabels[color]}
    />
  );
}

interface ColorIdentityProps {
  colors: ManaColor[];
  size?: "sm" | "md";
  className?: string;
}

/**
 * Displays a deck's color identity as a row of mana pips.
 * Colors are displayed in WUBRG order automatically.
 */
export function ColorIdentity({ colors, size = "md", className }: ColorIdentityProps) {
  // WUBRG order
  const order: ManaColor[] = ["W", "U", "B", "R", "G"];
  const sortedColors = order.filter((c) => colors.includes(c));

  if (sortedColors.length === 0) {
    return (
      <span
        className={cn(
          "text-mono-xs text-text-3",
          className
        )}
        title="Colorless"
      >
        C
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {sortedColors.map((color) => (
        <ManaPip key={color} color={color} size={size} />
      ))}
    </div>
  );
}
