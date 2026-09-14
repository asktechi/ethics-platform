"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Plus } from "lucide-react";
import {
  addToPoolAction,
  archivePoolAction,
  createPoolAction,
  getPoolAction,
  previewPoolAction,
  removeFromPoolAction,
  reorderPoolAction,
  updatePoolAction,
} from "@/app/(app)/_actions/question-pool.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PoolItem, PoolRow } from "@/lib/data/question-pools";
import type { QuestionRow } from "@/lib/data/questions";
import { cn } from "@/lib/utils";

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-start gap-2 border border-white/10 bg-navy/40 p-2"
    >
      <button type="button" className="mt-1 text-ivory/40" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PoolsBoard({
  classId,
  pools,
  questions,
}: {
  classId: string;
  pools: PoolRow[];
  questions: QuestionRow[];
}) {
  const [selectedId, setSelectedId] = useState(pools[0]?.id ?? "");
  const [name, setName] = useState("");
  const [items, setItems] = useState<PoolItem[]>([]);
  const [preview, setPreview] = useState<PoolItem[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selected = pools.find((pool) => pool.id === selectedId) ?? pools[0] ?? null;
  const inPool = new Set(items.map((item) => item.question_id));
  const addable = questions.filter((question) => !inPool.has(question.id) && !question.rejected && !question.deleted_at);
  const orderedIds = useMemo(() => items.map((item) => item.question_id), [items]);

  function loadPool(id: string) {
    setSelectedId(id);
    setPreview(null);
    start(async () => {
      const result = await getPoolAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.items);
    });
  }

  useEffect(() => {
    if (selectedId) loadPool(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function onDragEnd(event: DragEndEvent) {
    if (!selected || !event.over || event.active.id === event.over.id) return;
    const oldIndex = orderedIds.indexOf(String(event.active.id));
    const newIndex = orderedIds.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
    start(async () => {
      await reorderPoolAction(classId, selected.id, next);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ivory">Question pools</h1>
          <p className="text-sm text-ivory/55">
            Build a shuffled set, then launch a live quiz. The host loads items via <code>load_pool_questions</code>.
          </p>
        </div>
        <Button variant="outline" className="border-ivory/20 text-ivory" asChild>
          <Link href={`/class/${classId}/questions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Question bank
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 border border-border bg-card p-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              start(async () => {
                const result = await createPoolAction(classId, name.trim());
                if (!result.ok) setError(result.error);
                else {
                  setName("");
                  setSelectedId(result.pool.id);
                  router.refresh();
                }
              });
            }}
          >
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New pool name" />
            <Button type="submit" size="icon" disabled={pending} className="bg-gold text-navy hover:bg-gold/90">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <ul className="space-y-1">
            {pools.map((pool) => (
              <li key={pool.id}>
                <button
                  type="button"
                  onClick={() => loadPool(pool.id)}
                  className={cn(
                    "w-full px-2 py-2 text-left text-sm",
                    selected?.id === pool.id ? "bg-gold/15 font-medium text-ivory" : "text-ivory/70 hover:bg-white/5",
                  )}
                >
                  {pool.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="space-y-4 border border-border bg-card p-4">
          {!selected ? (
            <p className="text-sm text-ivory/45">Create a pool to start.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-ivory/70">Name</Label>
                  <Input
                    defaultValue={selected.name}
                    key={selected.id}
                    onBlur={(event) =>
                      start(async () => {
                        await updatePoolAction({ classId, poolId: selected.id, name: event.target.value });
                      })
                    }
                  />
                </div>
                <label className="flex items-end gap-2 text-sm text-ivory/80">
                  <input
                    type="checkbox"
                    defaultChecked={selected.shuffle_on_play}
                    key={`${selected.id}-sh`}
                    onChange={(event) =>
                      start(async () => {
                        await updatePoolAction({
                          classId,
                          poolId: selected.id,
                          shuffle_on_play: event.target.checked,
                        });
                      })
                    }
                  />
                  Shuffle on play
                </label>
                <div className="space-y-1.5">
                  <Label className="text-ivory/70">Seconds per question</Label>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={selected.time_per_q ?? ""}
                    key={`${selected.id}-t`}
                    onBlur={(event) =>
                      start(async () => {
                        const value = Number(event.target.value);
                        await updatePoolAction({
                          classId,
                          poolId: selected.id,
                          time_per_q: Number.isFinite(value) && value > 0 ? value : null,
                        });
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await previewPoolAction(selected.id);
                      if (!result.ok) setError(result.error);
                      else {
                        setPreview(result.items);
                        setPreviewIndex(0);
                      }
                    })
                  }
                >
                  Preview (shuffle dry run)
                </Button>
                <Button size="sm" className="bg-gold text-navy hover:bg-gold/90" asChild>
                  <Link href={`/class/${classId}/questions/pools/${selected.id}/launch`}>Launch live quiz</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => start(async () => { await archivePoolAction(classId, selected.id, false); })}
                >
                  Archive pool
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => start(async () => { await archivePoolAction(classId, selected.id, true); })}
                >
                  Restore pool
                </Button>
              </div>

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              {preview && preview.length > 0 ? (
                <div className="border border-white/10 bg-navy/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                    Dry run {previewIndex + 1} / {preview.length}
                  </p>
                  <p className="font-medium text-ivory">{preview[previewIndex]?.question?.stem ?? "Question unavailable"}</p>
                  <ol className="mt-2 list-inside list-[upper-alpha] text-sm text-ivory/70">
                    {(Array.isArray(preview[previewIndex]?.question.choices_json)
                      ? preview[previewIndex].question.choices_json
                      : []
                    ).map((choice) => (
                      <li key={choice.key}>{choice.text}</li>
                    ))}
                  </ol>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      disabled={previewIndex >= preview.length - 1}
                      onClick={() => setPreviewIndex((index) => Math.min(preview.length - 1, index + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <SortableItem key={item.id} id={item.question_id}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-ivory/90">{item.question?.stem ?? "Question unavailable"}</p>
                            <p className="text-[11px] text-ivory/40">
                              {item.question?.approved ? "approved" : item.question?.rejected ? "rejected" : "pending"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              start(async () => {
                                const result = await removeFromPoolAction(classId, selected.id, [item.question_id]);
                                if (!result.ok) {
                                  setError(result.error);
                                  return;
                                }
                                loadPool(selected.id);
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div>
                <p className="mb-2 text-sm font-medium text-ivory/80">Add from bank</p>
                {addable.length === 0 ? (
                  <p className="text-sm text-ivory/45">
                    No questions left to add. Import or restore items in the question bank, approve them, then come back.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {addable.map((question) => (
                      <button
                        key={question.id}
                        type="button"
                        disabled={pending}
                        className="block w-full border border-white/10 px-2 py-1.5 text-left text-sm text-ivory/80 hover:bg-white/5 disabled:opacity-50"
                        onClick={() =>
                          start(async () => {
                            const result = await addToPoolAction(classId, selected.id, [question.id]);
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            setError(null);
                            loadPool(selected.id);
                          })
                        }
                      >
                        <span className="block truncate">{question.stem.slice(0, 140)}</span>
                        <span className="text-[11px] text-ivory/40">
                          {question.approved ? "approved" : "pending — approve to make playable"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
