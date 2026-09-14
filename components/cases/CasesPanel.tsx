"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Plus } from "lucide-react";
import {
  archiveCaseStudyAction,
  saveCaseStudyAction,
  searchCaseQuestionsAction,
  updateCaseStudyAction,
} from "@/app/(app)/_actions/case-study.actions";
import { SortableItem } from "@/components/SortableItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CaseStudyRow } from "@/lib/data/case-studies";
import type { QuestionRow } from "@/lib/data/questions";

export function CasesPanel({
  classId,
  cases,
  questions,
}: {
  classId: string;
  cases: CaseStudyRow[];
  questions: QuestionRow[];
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; stem: string; standard: string | null }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const bank = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(
      (item) =>
        !item.deleted_at &&
        item.approved &&
        (!q || item.stem.toLowerCase().includes(q) || (item.standard?.code ?? "").toLowerCase().includes(q)),
    );
  }, [questions, search]);

  function startNew() {
    setEditingId(null);
    setTitle("");
    setScenario("");
    setSelected([]);
    setError(null);
    setOpen(true);
  }

  function startEdit(row: CaseStudyRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setScenario(row.scenario_text);
    setSelected((row.questions ?? []).map((item) => item.id));
    setError(null);
    setOpen(true);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selected.indexOf(String(active.id));
    const newIndex = selected.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setSelected(arrayMove(selected, oldIndex, newIndex));
  }

  function save() {
    setError(null);
    start(async () => {
      const payload = {
        classId,
        title,
        scenarioText: scenario,
        questionIds: selected,
      };
      const result = editingId
        ? await updateCaseStudyAction(editingId, payload)
        : await saveCaseStudyAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ivory/60">{cases.length} case{cases.length === 1 ? "" : "s"}</p>
        <Button className="bg-gold text-navy hover:bg-gold/90" onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" />
          New Case
        </Button>
      </div>

      {cases.length === 0 ? (
        <div className="border border-dashed border-white/15 p-8 text-center">
          <p className="font-display text-2xl text-ivory">No cases yet</p>
          <p className="mt-2 text-sm text-ivory/60">
            Write a vignette, attach 3–8 questions from the bank, then pick the case in a Case Study game.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((row) => (
            <li key={row.id} className="border border-white/10 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-xl text-ivory">{row.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-ivory/65">{row.scenario_text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="bg-gold/15 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-gold">
                      {row.question_count ?? 0} questions
                    </span>
                    {(row.tags ?? []).map((tag) => (
                      <span key={tag} className="border border-white/15 px-2 py-0.5 text-[11px] text-ivory/70">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      start(async () => {
                        await archiveCaseStudyAction(row.id, classId);
                      })
                    }
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-l border-white/10 bg-navy sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-ivory">{editingId ? "Edit case" : "New case"}</SheetTitle>
            <SheetDescription className="text-ivory/55">
              A case is a shared vignette plus 3–8 questions the class answers in order.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Scenario</Label>
              <Textarea
                className="min-h-40"
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
                placeholder="The shared vignette players read before the first question."
              />
            </div>
            <div className="space-y-2">
              <Label>Attach questions</Label>
              <Input
                placeholder="Search by stem"
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  if (value.trim().length < 2) return;
                  void searchCaseQuestionsAction(classId, value).then((result) => {
                    if (result.ok) setHits(result.questions);
                  });
                }}
              />
              <div className="max-h-40 space-y-1 overflow-auto border border-white/10 p-2">
                {(hits.length ? hits : bank.slice(0, 20)).map((item) => {
                  const id = "id" in item ? item.id : "";
                  const stem = "stem" in item ? item.stem : "";
                  const checked = selected.includes(id);
                  return (
                    <label key={id} className="flex items-start gap-2 text-sm text-ivory/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelected((current) =>
                            event.target.checked ? [...current, id] : current.filter((value) => value !== id),
                          );
                        }}
                      />
                      <span className="line-clamp-2">{stem}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-ivory/45">{selected.length} selected · drag to reorder</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-2">
                    {selected.map((id, index) => {
                      const question = questions.find((item) => item.id === id);
                      return (
                        <SortableItem key={id} id={id}>
                          {({ attributes, listeners }) => (
                            <li className="flex items-start gap-2 border border-white/10 bg-navy/50 p-2 text-sm">
                              <button type="button" className="mt-0.5 text-ivory/40" {...attributes} {...listeners}>
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <span className="text-gold">{index + 1}.</span>
                              <span className="min-w-0 flex-1 line-clamp-2">{question?.stem ?? id}</span>
                            </li>
                          )}
                        </SortableItem>
                      );
                    })}
                  </ol>
                </SortableContext>
              </DndContext>
            </div>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-navy hover:bg-gold/90" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
