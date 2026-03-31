"use client";

import { cn } from "@/lib/utils";
import type { FormatSummary } from "@/types/format";

type FormatSelectorProps = {
  formats: FormatSummary[];
  selectedFormat: FormatSummary | null;
  onSelect: (format: FormatSummary) => void;
};

function getFormatDescription(format: FormatSummary): string {
  const playerText = format.maxPlayers
    ? format.minPlayers === format.maxPlayers
      ? `${format.minPlayers} players`
      : `${format.minPlayers}-${format.maxPlayers} players`
    : `${format.minPlayers}+ players`;

  const teamText = format.hasTeams ? " • Team-based" : "";
  return playerText + teamText;
}

export function FormatSelector({
  formats,
  selectedFormat,
  onSelect,
}: FormatSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-text-1">Format</label>
      <div className="flex flex-wrap gap-2">
        {formats.map((format) => (
          <button
            key={format.id}
            type="button"
            onClick={() => onSelect(format)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              selectedFormat?.id === format.id
                ? "bg-accent-fill text-text-1 shadow-[0_0_12px_rgba(136,24,200,0.3)]"
                : "bg-card border border-card-border text-text-2 hover:border-card-border-hi hover:text-text-1"
            )}
          >
            {format.name}
          </button>
        ))}
      </div>
      {selectedFormat && (
        <p className="text-xs text-text-2">
          {getFormatDescription(selectedFormat)}
        </p>
      )}
    </div>
  );
}
