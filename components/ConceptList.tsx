"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Plus } from "lucide-react";
import {
  archiveConceptAction,
  createConceptAction,
  reorderConceptsAction,
  restoreConceptAction,
  updateConceptAction,
} from "@/app/(app)/_actions/concept.actions";
import { EmptyState } from "@/components/EmptyState";
import { InlineEditableText } from "@/components/InlineEditableText";
import { SortableItem } from "@/components/SortableItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Concept } from "@/types/db.helpers";

export function ConceptList({
  classId,
  sectionId,
  concepts,
  showArchived,
}: {
  classId: string;
  sectionId: string | null;
  concepts: Concept[];
  showArchived: boolean;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const scoped = useMemo(
    () => concepts.filter((concept) => concept.section_id === sectionId),
    [concepts, sectionId],
  );
  const active = scoped.filter((concept) => !concept.deleted_at).sort((a, b) => a.order - b.order);
  const archived = scoped.filter((concept) => concept.deleted_at);

  if (!sectionId) {
    return (
      <EmptyState
        title="Select a section"
        description="Choose a section on the left, then add one idea per concept."
      />
    );
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || !sectionId || dragged.id === over.id) return;
    const ids = active.map((concept) => concept.id);
    const from = ids.indexOf(String(dragged.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const result = await reorderConceptsAction({
      classId,
      sectionId,
      orderedIds: next,
    });
    if (!result.ok) setError(result.error);
  }

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
        Concepts
      </h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
        <SortableContext items={active.map((concept) => concept.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {active.map((concept) => (
              <SortableItem key={concept.id} id={concept.id}>
                {({ attributes, listeners }) => (
                  <li className="flex items-center gap-2 border border-border bg-card px-2 py-2">
                    <button
                      type="button"
                      className="text-ivory/40 hover:text-gold"
                      aria-label="Drag concept"
                      {...attributes}
                      {...listeners}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <InlineEditableText
                        value={concept.title}
                        as="span"
                        className="block text-sm text-ivory"
                        onSave={async (next) => {
                          const result = await updateConceptAction({
                            id: concept.id,
                            classId,
                            title: next,
                          });
                          if (!result.ok) setError(result.error);
                        }}
                      />
                      <Badge
                        variant="outline"
                        className="mt-1 border-ivory/20 font-normal text-ivory/50"
                      >
                        0 standards linked
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-ivory/60"
                      onClick={() =>
                        void archiveConceptAction({ id: concept.id, classId })
                      }
                    >
                      Archive
                    </Button>
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {showArchived
        ? archived.map((concept) => (
            <div
              key={concept.id}
              className="mt-2 flex items-center justify-between border border-border bg-card/40 px-3 py-2 opacity-60"
            >
              <p className="text-sm text-ivory">{concept.title}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void restoreConceptAction({ id: concept.id, classId })}
              >
                Restore
              </Button>
            </div>
          ))
        : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const result = await createConceptAction({
              classId,
              sectionId,
              title,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setTitle("");
            setError(null);
          })();
        }}
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="One idea — new concept"
          className="border-border bg-navy text-ivory"
        />
        <Button type="submit" className="bg-gold text-navy hover:bg-gold/90">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {active.length === 0 ? (
        <p className="mt-4 text-sm text-ivory/50">
          Every concept is one idea. Add the first point for this section.
        </p>
      ) : null}
    </div>
  );
}
