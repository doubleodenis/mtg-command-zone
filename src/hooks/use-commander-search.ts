"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchCommanders, type ScryfallCard } from "@/lib/scryfall/api";

interface UseCommanderSearchOptions {
  /** Minimum query length before search triggers (default: 2) */
  minLength?: number;
  /** Debounce delay in milliseconds (default: 300) */
  delay?: number;
  /** Maximum number of results to return (default: 6) */
  limit?: number;
  /** Whether search is enabled (default: true) */
  enabled?: boolean;
}

interface UseCommanderSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: ScryfallCard[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectCommander: (card: ScryfallCard) => string;
  clear: () => void;
}

/**
 * Hook for searching MTG commanders via the Scryfall API.
 * Provides debounced search, loading state, and result management.
 *
 * @example
 * const commander = useCommanderSearch();
 *
 * <Input
 *   value={commander.query}
 *   onChange={(e) => commander.setQuery(e.target.value)}
 *   onFocus={() => commander.setIsOpen(true)}
 * />
 *
 * {commander.isOpen && commander.results.map(card => (
 *   <button onClick={() => onSelect(commander.selectCommander(card))}>
 *     {card.name}
 *   </button>
 * ))}
 */
export function useCommanderSearch(
  options: UseCommanderSearchOptions = {}
): UseCommanderSearchReturn {
  const { minLength = 2, delay = 300, limit = 6, enabled = true } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear results
  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }, []);

  // Select a commander and return its name
  const selectCommander = useCallback((card: ScryfallCard): string => {
    clear();
    return card.name;
  }, [clear]);

  // Debounced search effect
  useEffect(() => {
    if (!enabled || query.length < minLength) {
      setResults([]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const commanders = await searchCommanders(query);
        setResults(commanders.slice(0, limit));
        setIsOpen(commanders.length > 0);
      } catch (error) {
        console.error("Commander search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, minLength, delay, limit, enabled]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selectCommander,
    clear,
  };
}
