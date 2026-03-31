"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
// import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function NavbarSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // TODO: Re-enable Supabase when backend is configured
      // setIsLoading(true);
      // const supabase = createClient();
      // const { data } = await supabase
      //   .from("profiles")
      //   .select("id, username, display_name, avatar_url")
      //   .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      //   .limit(5);
      // setResults((data as SearchResult[]) || []);
      // setIsOpen(true);
      // setIsLoading(false);
      
      // Return empty results for now
      setResults([]);
      setIsOpen(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setIsOpen(false);
    router.push(`/player/${result.username}`);
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          position: "relative",
          borderRadius: "0.5rem",
          overflow: "hidden",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          transition: "all 0.2s",
        }}
      >
        <svg
          style={{
            position: "absolute",
            left: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            height: "1rem",
            width: "1rem",
            color: "#71717a",
          }}
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
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search players..."
          style={{
            width: "100%",
            height: "2.25rem",
            paddingLeft: "2.25rem",
            paddingRight: "1rem",
            fontSize: "0.875rem",
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
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <div
              style={{
                height: "0.875rem",
                width: "0.875rem",
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
            borderRadius: "0.5rem",
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
                padding: "0.5rem 0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
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
                  height: "1.75rem",
                  width: "1.75rem",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
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
                <div style={{ fontWeight: 500, color: "#ffffff", fontSize: "0.875rem" }}>
                  {result.display_name || result.username}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
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
