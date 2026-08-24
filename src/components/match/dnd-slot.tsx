"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
    setActivatorNodeRef,
    transform,
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
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "relative rounded-lg transition-shadow",
        isOver && "ring-2 ring-accent",
        isDragging && "opacity-50 z-10",
        className
      )}
    >
      {draggable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to move this player"
          className="absolute top-1 right-1 z-10 p-1 rounded text-text-2 hover:text-text-1 hover:bg-card-raised cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {children}
    </div>
  );
}
