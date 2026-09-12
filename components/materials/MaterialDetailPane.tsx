"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { PptxFallbackBanner } from "@/components/materials/PptxFallbackBanner";
import { SlideRow } from "@/components/materials/SlideRow";
import type { MaterialDetail } from "@/lib/data/materials.types";
import type { Slide } from "@/types/db.helpers";

function formatBytes(size: number | null) {
  if (!size) return "Unknown size";
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

export function MaterialDetailPane({
  detail,
  loading,
  error,
  onApproveAll,
  onOpenSlide,
  onReorder,
}: {
  detail: MaterialDetail | null;
  loading: boolean;
  error: string | null;
  onApproveAll: () => void;
  onOpenSlide: (slide: Slide) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  if (loading) {
    return (
      <div className="border border-border bg-card/40 p-6 text-sm text-ivory/60">
        Loading material…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-900/40 bg-card p-6 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        title="Select a material"
        description="Choose a file on the left to review the intended presentation, edit slides, and approve the draft."
      />
    );
  }

  function onDragEnd(event: DragEndEvent) {
    if (!detail) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = detail.slides.map((slide) => slide.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  return (
    <div className="space-y-5">
      <header className="border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Intended presentation
            </p>
            <h2 className="mt-2 font-display text-2xl text-ivory">
              {detail.original_filename}
            </h2>
            <p className="mt-2 font-mono text-xs text-ivory/50">
              {detail.sha256.slice(0, 12)} · {detail.type} ·{" "}
              {formatBytes(detail.byte_size)} ·{" "}
              {new Date(detail.uploaded_at).toLocaleString()} · {detail.versionLabel}
            </p>
          </div>
          <Button type="button" onClick={onApproveAll}>
            Approve all
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{detail.slideCount} slides</Badge>
          <Badge variant="secondary">
            {detail.slides.filter((slide) => slide.status === "approved").length} approved
          </Badge>
        </div>
      </header>

      {detail.type === "pptx" ? <PptxFallbackBanner /> : null}

      {detail.slides.length === 0 ? (
        <EmptyState
          title="No slides derived"
          description="Re-extract this original or upload a different file. The original is unchanged."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={detail.slides.map((slide) => slide.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {detail.slides.map((slide) => (
                <li key={slide.id}>
                  <SlideRow slide={slide} onOpen={() => onOpenSlide(slide)} />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
