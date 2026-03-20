import { cn } from "@/lib/utils";

export type ConfirmationState = "confirmed" | "pending" | "unconfirmed";

interface ConfirmationStatusProps {
  status: ConfirmationState;
  /** Show the label text alongside the indicator */
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<ConfirmationState, { label: string; dotClass: string; labelClass: string }> = {
  confirmed: {
    label: "Confirmed",
    dotClass: "bg-win",
    labelClass: "text-win",
  },
  pending: {
    label: "Pending",
    dotClass: "bg-gold",
    labelClass: "text-gold",
  },
  unconfirmed: {
    label: "Unconfirmed",
    dotClass: "bg-text-3",
    labelClass: "text-text-2",
  },
};

/**
 * Displays match confirmation status as a colored dot with optional label.
 * Used in match cards and participant lists.
 */
export function ConfirmationStatus({ 
  status, 
  showLabel = false,
  className 
}: ConfirmationStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      title={config.label}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          config.dotClass
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={cn("text-mono-xs", config.labelClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

interface ConfirmationCountProps {
  confirmed: number;
  total: number;
  className?: string;
}

/**
 * Displays confirmation progress as "X/Y confirmed".
 * Used in match cards to show how many participants have confirmed.
 */
export function ConfirmationCount({ confirmed, total, className }: ConfirmationCountProps) {
  const isComplete = confirmed === total;
  const isPending = confirmed > 0 && confirmed < total;

  return (
    <span
      className={cn(
        "text-mono-xs",
        isComplete && "text-win",
        isPending && "text-gold",
        !isComplete && !isPending && "text-text-2",
        className
      )}
    >
      {confirmed}/{total}
    </span>
  );
}
