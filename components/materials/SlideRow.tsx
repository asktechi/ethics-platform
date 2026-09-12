"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types/db.helpers";

export function SlideRow({
  slide,
  onOpen,
}: {
  slide: Slide;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-start gap-3 border border-border bg-card/60 px-3 py-3",
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab text-ivory/40"
        {...attributes}
        {...listeners}
        aria-label={`Reorder slide ${slide.order}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-gold">{slide.order}</span>
          <p className="truncate text-sm font-medium text-ivory">
            {slide.title || "Untitled slide"}
          </p>
          <Badge variant="outline">{slide.layout ?? "point"}</Badge>
          <Badge
            variant={slide.status === "approved" ? "default" : "secondary"}
            className={slide.status === "approved" ? "bg-gold text-navy" : undefined}
          >
            {slide.status}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-ivory/55">
          {slide.body || "No body yet."}
        </p>
      </button>
    </div>
  );
}
