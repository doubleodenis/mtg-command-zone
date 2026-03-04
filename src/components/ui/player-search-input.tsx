"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: "rgba(18, 18, 26, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: isOpen ? "0 0 30px rgba(168, 85, 247, 0.15)" : "none",
        }}
      >
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5"
          style={{ color: "#71717a" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="w-full h-14 pl-12 pr-12 text-base outline-none"
          style={{
            backgroundColor: "transparent",
            color: "#ffffff",
          }}
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#a855f7", borderTopColor: "transparent" }}
            />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            backgroundColor: "rgba(18, 18, 26, 0.98)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
          }}
        >
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors duration-200"
              style={{ backgroundColor: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#a1a1aa",
                }}
              >
                {result.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.avatar_url}
                    alt={result.username}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  result.username.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="font-medium text-white">
                  {result.display_name || result.username}
                </div>
                <div className="text-sm" style={{ color: "#71717a" }}>
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
