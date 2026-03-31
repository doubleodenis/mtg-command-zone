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
    color_identity?: string[];
  } | null;
  onChange?: (commander: {
    scryfall_id: string;
    name: string;
    image_uri: string;
    color_identity: string[];
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
      color_identity: card.color_identity,
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
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem",
          backgroundColor: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "0.5rem",
        }}>
          <div style={{
            position: "relative",
            height: "4rem",
            width: "3rem",
            borderRadius: "0.25rem",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            <Image
              src={value.image_uri}
              alt={value.name}
              fill
              className="object-cover"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 500,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {value.name}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: "0.5rem",
              color: "#a1a1aa",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#ffffff"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#a1a1aa"}
          >
            <svg
              style={{ height: "1.25rem", width: "1.25rem" }}
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
      <div style={{ position: "relative" }}>
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
          <div style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
          }}>
            <div style={{
              height: "1rem",
              width: "1rem",
              borderRadius: "50%",
              border: "2px solid #a855f7",
              borderTopColor: "transparent",
              animation: "spin 1s linear infinite",
            }} />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: "0.5rem",
          backgroundColor: "rgba(18, 18, 26, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "0.5rem",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          zIndex: 50,
          maxHeight: "20rem",
          overflowY: "auto",
        }}>
          {results.map((card) => {
            const imageUri = getCardImageUri(card, "small");
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelect(card)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#ffffff",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{
                  position: "relative",
                  height: "3rem",
                  width: "2.25rem",
                  borderRadius: "0.25rem",
                  overflow: "hidden",
                  flexShrink: 0,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                }}>
                  <Image
                    src={imageUri}
                    alt={card.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500,
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {card.name}
                  </div>
                  <div style={{
                    fontSize: "0.75rem",
                    color: "#a1a1aa",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {card.type_line}
                  </div>
                </div>
                {/* Color identity dots */}
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {card.color_identity.map((color) => {
                    const colorMap: Record<string, string> = {
                      W: "#ffffff",
                      U: "#3b82f6",
                      B: "#1f2937",
                      R: "#ef4444",
                      G: "#22c55e",
                    };
                    return (
                      <div
                        key={color}
                        style={{
                          height: "0.75rem",
                          width: "0.75rem",
                          borderRadius: "50%",
                          backgroundColor: colorMap[color] || "#6b7280",
                        }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
