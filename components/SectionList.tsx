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
  archiveSectionAction,
  createSectionAction,
  reorderSectionsAction,
  restoreSectionAction,
  updateSectionAction,
} from "@/app/(app)/_actions/section.actions";
import { InlineEditableText } from "@/components/InlineEditableText";
import { SortableItem } from "@/components/SortableItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Concept, Section } from "@/types/db.helpers";

export function SectionList({
  classId,
  sections,
  concepts,
  selectedId,
  onSelect,
  showArchived,
}: {
  classId: string;
  sections: Section[];
  concepts: Concept[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showArchived: boolean;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const active = useMemo(
    () => sections.filter((section) => !section.deleted_at).sort((a, b) => a.order - b.order),
    [sections],
  );
  const archived = useMemo(
    () => sections.filter((section) => section.deleted_at),
    [sections],
  );

  async function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const ids = active.map((section) => section.id);
    const from = ids.indexOf(String(dragged.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const result = await reorderSectionsAction({ classId, orderedIds: next });
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          Sections
        </h3>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
        <SortableContext items={active.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {active.map((section) => {
              const count = concepts.filter(
                (concept) => concept.section_id === section.id && !concept.deleted_at,
              ).length;
              return (
                <SortableItem key={section.id} id={section.id}>
                  {({ attributes, listeners }) => (
                    <li
                      className={cn(
                        "flex items-center gap-2 border border-border bg-card px-2 py-2",
                        selectedId === section.id && "border-gold/60",
                      )}
                    >
                      <button
                        type="button"
                        className="text-ivory/40 hover:text-gold"
                        aria-label="Drag section"
                        {...attributes}
                        {...listeners}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelect(section.id)}
                          className="mb-1 block text-[0.7rem] text-ivory/45 hover:text-gold"
                        >
                          {count} {count === 1 ? "concept" : "concepts"} · select
                        </button>
                        <InlineEditableText
                          value={section.title}
                          as="span"
                          className="block text-sm text-ivory"
                          onSave={async (next) => {
                            const result = await updateSectionAction({
                              id: section.id,
                              classId,
                              title: next,
                            });
                            if (!result.ok) setError(result.error);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-ivory/60"
                        onClick={() =>
                          void archiveSectionAction({ id: section.id, classId })
                        }
                      >
                        Archive
                      </Button>
                    </li>
                  )}
                </SortableItem>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>

      {showArchived
        ? archived.map((section) => (
            <div
              key={section.id}
              className="mt-2 flex items-center justify-between border border-border bg-card/40 px-3 py-2 opacity-60"
            >
              <p className="text-sm text-ivory">{section.title}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void restoreSectionAction({ id: section.id, classId })}
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
            const result = await createSectionAction({ classId, title });
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
          placeholder="New section"
          className="border-border bg-navy text-ivory"
        />
        <Button type="submit" className="bg-gold text-navy hover:bg-gold/90">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {active.length === 0 ? (
        <p className="mt-4 text-sm text-ivory/50">Add the first section for this class.</p>
      ) : null}
      {showArchived && archived.length === 0 ? (
        <Badge variant="outline" className="mt-3 w-fit border-ivory/20 text-ivory/45">
          No archived sections
        </Badge>
      ) : null}
    </div>
  );
}
