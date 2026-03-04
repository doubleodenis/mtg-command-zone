"use client";

import * as React from "react";
import Image from "next/image";
import { searchCommanders, getCardImageUri, type ScryfallCard } from "@/lib/scryfall/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface CommanderPickerProps {
  value?: {
    scryfall_id: string;
    name: string;
    image_uri: string;
  } | null;
  onChange?: (commander: {
    scryfall_id: string;
    name: string;
    image_uri: string;
  } | null) => void;
  className?: string;
  placeholder?: string;
}

export function CommanderPicker({
  value,
  onChange,
  className,
  placeholder = "Search for a commander...",
}: CommanderPickerProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ScryfallCard[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const commanders = await searchCommanders(query);
        setResults(commanders.slice(0, 8));
        setIsOpen(commanders.length > 0);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  const handleSelect = (card: ScryfallCard) => {
    const imageUri = getCardImageUri(card, "normal");
    onChange?.({
      scryfall_id: card.id,
      name: card.name,
      image_uri: imageUri,
    });
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.(null);
    setQuery("");
  };

  if (value) {
    return (
      <div className={cn("relative", className)}>
        <div className="flex items-center gap-3 p-3 glass-card">
          <div className="relative h-16 w-12 rounded overflow-hidden flex-shrink-0">
            <Image
              src={value.image_uri}
              alt={value.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">
              {value.name}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-foreground-muted hover:text-foreground transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background-secondary border border-surface-border rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((card) => {
            const imageUri = getCardImageUri(card, "small");
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelect(card)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-surface transition-colors text-left"
              >
                <div className="relative h-12 w-9 rounded overflow-hidden flex-shrink-0 bg-surface">
                  <Image
                    src={imageUri}
                    alt={card.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {card.name}
                  </div>
                  <div className="text-xs text-foreground-muted truncate">
                    {card.type_line}
                  </div>
                </div>
                {/* Color identity dots */}
                <div className="flex gap-1">
                  {card.color_identity.map((color) => (
                    <div
                      key={color}
                      className={cn("h-3 w-3 rounded-full", {
                        "bg-white": color === "W",
                        "bg-blue-500": color === "U",
                        "bg-gray-800": color === "B",
                        "bg-red-500": color === "R",
                        "bg-green-500": color === "G",
                      })}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
