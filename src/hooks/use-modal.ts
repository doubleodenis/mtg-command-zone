"use client";

import { useState, useCallback, useMemo } from "react";

interface UseModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Hook for managing modal/dropdown open state.
 * Provides stable callbacks for open, close, and toggle actions.
 *
 * @param initialState - Initial open state (default: false)
 *
 * @example
 * const modal = useModal();
 *
 * <Button onClick={modal.open}>Open Modal</Button>
 * <Modal isOpen={modal.isOpen} onClose={modal.close}>
 *   ...
 * </Modal>
 */
export function useModal(initialState: boolean = false): UseModalReturn {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
    }),
    [isOpen, open, close, toggle]
  );
}
