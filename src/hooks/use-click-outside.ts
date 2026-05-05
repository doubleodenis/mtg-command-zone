"use client";

import { useEffect, type RefObject } from "react";

/**
 * Hook to detect clicks outside a referenced element.
 * Useful for closing dropdowns, modals, and other overlay components.
 *
 * @param ref - Reference to the element to watch
 * @param handler - Callback when click occurs outside the element
 * @param enabled - Whether the listener is active (default: true)
 *
 * @example
 * const dropdownRef = useRef<HTMLDivElement>(null);
 * useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, handler, enabled]);
}
