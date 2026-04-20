"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchResult {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface PlayerSearchInputProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => Promise<SearchResult[]>;
}

export function PlayerSearchInput({
  className = "",
  placeholder = "Search for a player...",
  onSearch,
}: PlayerSearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
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
        if (onSearch) {
          const searchResults = await onSearch(query);
          setResults(searchResults);
          setIsOpen(searchResults.length > 0);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, onSearch]);

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setIsOpen(false);
    router.push(`/player/${result.username}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.length >= 2) {
      router.push(`/player/${query}`);
      setIsOpen(false);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div
        style={{
          position: "relative",
          borderRadius: "0.75rem",
          overflow: "hidden",
          backgroundColor: "rgba(18, 18, 26, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: isOpen ? "0 0 30px rgba(168, 85, 247, 0.15)" : "none",
          transition: "all 0.2s",
        }}
      >
        <Search
          style={{
            position: "absolute",
            left: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            height: "1.25rem",
            width: "1.25rem",
            color: "#a1a1aa",
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          style={{
            width: "100%",
            height: "3.5rem",
            paddingLeft: "3rem",
            paddingRight: "3rem",
            fontSize: "1rem",
            backgroundColor: "transparent",
            color: "#ffffff",
            border: "none",
            outline: "none",
          }}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              right: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <div
              style={{
                height: "1.25rem",
                width: "1.25rem",
                borderRadius: "50%",
                border: "2px solid #a855f7",
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
              }}
            />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.5rem",
            borderRadius: "0.75rem",
            overflow: "hidden",
            zIndex: 50,
            backgroundColor: "rgba(18, 18, 26, 0.98)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
          }}
        >
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                textAlign: "left",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div
                style={{
                  height: "2.5rem",
                  width: "2.5rem",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  overflow: "hidden",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#a1a1aa",
                }}
              >
                {result.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.avatar_url}
                    alt={result.username}
                    style={{
                      height: "100%",
                      width: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  result.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div style={{ fontWeight: 500, color: "#ffffff" }}>
                  {result.display_name || result.username}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#71717a" }}>
                  @{result.username}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
