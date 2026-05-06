"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseDebouncedSearchOptions<T> {
  /** Minimum query length before search triggers */
  minLength?: number;
  /** Debounce delay in milliseconds */
  delay?: number;
  /** Search function that returns results */
  onSearch: (query: string) => Promise<T[]>;
}

interface UseDebouncedSearchReturn<T> {
  query: string;
  setQuery: (query: string) => void;
  results: T[];
  isLoading: boolean;
  clearResults: () => void;
}

/**
 * Hook for debounced search functionality.
 * Automatically debounces search queries and manages loading state.
 *
 * @example
 * const { query, setQuery, results, isLoading } = useDebouncedSearch({
 *   onSearch: async (q) => searchUsers(q),
 *   minLength: 2,
 *   delay: 300,
 * });
 */
export function useDebouncedSearch<T>({
  minLength = 2,
  delay = 300,
  onSearch,
}: UseDebouncedSearchOptions<T>): UseDebouncedSearchReturn<T> {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  useEffect(() => {
    if (query.length < minLength) {
      setResults([]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults = await onSearch(query);
        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
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
  }, [query, minLength, delay, onSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    clearResults,
  };
}
