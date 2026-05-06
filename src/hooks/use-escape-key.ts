"use client";

import { useEffect } from "react";

/**
 * Hook to detect Escape key presses.
 * Useful for closing dropdowns, modals, and other overlay components.
 *
 * @param handler - Callback when Escape key is pressed
 * @param enabled - Whether the listener is active (default: true)
 *
 * @example
 * useEscapeKey(() => setIsOpen(false), isOpen);
 */
export function useEscapeKey(handler: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handler();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handler, enabled]);
}
