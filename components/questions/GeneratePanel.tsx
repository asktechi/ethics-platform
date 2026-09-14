"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { bulkQuestionAction, generateQuestionsAction } from "@/app/(app)/_actions/question.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionRow } from "@/lib/data/questions";
import type { Concept, Standard } from "@/types/db.helpers";

export function GeneratePanel({
  classId,
  standards,
  concepts,
  slides,
}: {
  classId: string;
  standards: Standard[];
  concepts: Concept[];
  slides: Array<{ id: string; title: string; body: string }>;
}) {
  const [standardId, setStandardId] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [style, setStyle] = useState<"mcq" | "scenario" | "mixed">("mcq");
  const [sourceText, setSourceText] = useState("");
  const [slideIds, setSlideIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState<QuestionRow[]>([]);
  const [pending, start] = useTransition();

  const filteredConcepts = useMemo(() => concepts, [concepts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ivory">Generate questions</h1>
          <p className="text-sm text-ivory/55">
            Drafts stay unapproved until you review them. Ethics reasoning only — no investment advice.
          </p>
        </div>
        <Button variant="outline" className="border-ivory/20 text-ivory" asChild>
          <Link href={`/class/${classId}/questions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Question bank
          </Link>
        </Button>
      </div>

      <form
        className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          start(async () => {
            const result = await generateQuestionsAction({
              classId,
              standardId,
              conceptId: conceptId || undefined,
              count,
              difficulty,
              style,
              sourceText,
              slideIds,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setInserted((result.inserted ?? []) as QuestionRow[]);
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="g-std" className="text-ivory/70">
            Standard
          </Label>
          <select
            id="g-std"
            required
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={standardId}
            onChange={(event) => {
              setStandardId(event.target.value);
              setConceptId("");
            }}
          >
            <option value="">Select a Standard</option>
            {standards.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-con" className="text-ivory/70">
            Concept
          </Label>
          <select
            id="g-con"
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={conceptId}
            onChange={(event) => setConceptId(event.target.value)}
          >
            <option value="">Any in this class</option>
            {filteredConcepts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-count" className="text-ivory/70">
            Count
          </Label>
          <select
            id="g-count"
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-diff" className="text-ivory/70">
            Difficulty
          </Label>
          <select
            id="g-diff"
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="g-style" className="text-ivory/70">
            Style
          </Label>
          <select
            id="g-style"
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={style}
            onChange={(event) => setStyle(event.target.value as typeof style)}
          >
            <option value="mcq">MCQ</option>
            <option value="scenario">Scenario</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="g-src" className="text-ivory/70">
            Source text (paste from materials)
          </Label>
          <Textarea
            id="g-src"
            rows={6}
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste teaching notes, a vignette, or Standard excerpts. If empty, generation uses the Standard body plus any selected slides."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-ivory/70">Or pick approved slides from this class</Label>
          {slides.length === 0 ? (
            <p className="text-sm text-ivory/45">No approved slides yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {slides.map((slide) => (
                <label key={slide.id} className="flex items-start gap-2 border border-white/10 p-2 text-sm text-ivory/80">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={slideIds.includes(slide.id)}
                    onChange={(event) =>
                      setSlideIds((prev) =>
                        event.target.checked ? [...prev, slide.id] : prev.filter((id) => id !== slide.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">{slide.title}</span>
                    <span className="mt-0.5 block line-clamp-2 text-xs text-ivory/45">{slide.body}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="bg-gold text-navy hover:bg-gold/90">
            {pending ? "Generating…" : "Generate"}
          </Button>
        </div>
      </form>

      {inserted.length > 0 ? (
        <section className="space-y-3 border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ivory">Review generated drafts</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await bulkQuestionAction({
                    classId,
                    ids: inserted.slice(0, 3).map((item) => item.id),
                    action: "approve",
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setError(null);
                  setInserted((prev) =>
                    prev.map((item, index) => (index < 3 ? { ...item, approved: true } : item)),
                  );
                })
              }
            >
              Approve first 3
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-ivory/45">
                <tr>
                  <th className="px-2 py-2">Stem</th>
                  <th className="px-2 py-2">Answer</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inserted.map((question) => (
                  <tr key={question.id} className="border-b border-white/5">
                    <td className="max-w-xl px-2 py-2 text-ivory/90">
                      <p>{question.stem}</p>
                      <ol className="mt-1 list-inside list-[upper-alpha] text-xs text-ivory/55">
                        {asChoices(question.choices_json).map((choice) => (
                          <li key={choice.key}>{choice.text}</li>
                        ))}
                      </ol>
                    </td>
                    <td className="px-2 py-2 text-ivory/70">{question.answer_key}</td>
                    <td className="px-2 py-2 text-ivory/70">{question.approved ? "approved" : "pending"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          disabled={pending || question.approved}
                          onClick={() =>
                            start(async () => {
                              const result = await bulkQuestionAction({ classId, ids: [question.id], action: "approve" });
                              if (!result.ok) {
                                setError(result.error);
                                return;
                              }
                              setError(null);
                              setInserted((prev) =>
                                prev.map((item) => (item.id === question.id ? { ...item, approved: true } : item)),
                              );
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const result = await bulkQuestionAction({ classId, ids: [question.id], action: "reject" });
                              if (!result.ok) {
                                setError(result.error);
                                return;
                              }
                              setError(null);
                              setInserted((prev) => prev.filter((item) => item.id !== question.id));
                            })
                          }
                        >
                          Skip
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function asChoices(value: QuestionRow["choices_json"]) {
  return Array.isArray(value) ? value : [];
}
