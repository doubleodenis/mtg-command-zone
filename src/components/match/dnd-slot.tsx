"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export type DndSlotProps = {
  index: number;
  draggable: boolean;
  children: React.ReactNode;
  className?: string;
};

export function DndSlot({ index, draggable, children, className }: DndSlotProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot:${index}`,
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `seat:${index}`,
    disabled: !draggable,
  });

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDropRef(node);
      setDragRef(node);
    },
    [setDropRef, setDragRef]
  );

  return (
    <div
      ref={setRefs}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "rounded-lg transition-shadow",
        isOver && "ring-2 ring-accent",
        isDragging && "opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}
