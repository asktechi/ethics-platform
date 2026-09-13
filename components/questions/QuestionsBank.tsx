"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  approveTagProposalsAction,
  autoTagUntaggedAction,
  bulkQuestionAction,
  importQuestionsAction,
  updateQuestionAction,
} from "@/app/(app)/_actions/question.actions";
import { addToPoolAction, createPoolAction } from "@/app/(app)/_actions/question-pool.actions";
import { QuestionDrawer } from "@/components/questions/QuestionDrawer";
import { TagReview } from "@/components/questions/TagReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuestionRow } from "@/lib/data/questions";
import type { Concept, Standard } from "@/types/db.helpers";

export function QuestionsBank({
  classId,
  initialQuestions,
  standards,
  concepts,
  spend,
}: {
  classId: string;
  initialQuestions: QuestionRow[];
  standards: Standard[];
  concepts: Concept[];
  spend: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [source, setSource] = useState<"all" | "imported" | "ai_generated" | "mine">("all");
  const [standardFilter, setStandardFilter] = useState<string[]>([]);
  const [conceptFilter, setConceptFilter] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [proposals, setProposals] = useState<
    Array<{
      questionId: string;
      standard_id: string | null;
      concept_id: string | null;
      difficulty: "easy" | "medium" | "hard";
      confidence: number;
      reasoning: string;
    }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [aiSpend, setAiSpend] = useState(spend);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    return questions.filter((question) => {
      if (!archived && question.deleted_at) return false;
      if (search && !question.stem.toLowerCase().includes(search.toLowerCase())) return false;
      if (status === "approved" && !question.approved) return false;
      if (status === "rejected" && !question.rejected) return false;
      if (status === "pending" && (question.approved || question.rejected)) return false;
      if (source !== "all" && question.source !== source) return false;
      if (standardFilter.length && (!question.standard_id || !standardFilter.includes(question.standard_id))) {
        return false;
      }
      if (conceptFilter.length && (!question.concept_id || !conceptFilter.includes(question.concept_id))) {
        return false;
      }
      if (difficulty.length && (!question.difficulty || !difficulty.includes(question.difficulty))) return false;
      return true;
    });
  }, [archived, conceptFilter, difficulty, questions, search, source, standardFilter, status]);

  const active = questions.find((question) => question.id === activeId) ?? null;
  const standardGroups = groupStandards(standards);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.md,.docx,.pdf,.pptx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const data = new FormData();
            data.set("classId", classId);
            data.set("file", file);
            start(async () => {
              const result = await importQuestionsAction(data);
              setMessage(result.ok ? `Imported ${result.count}. ${(result.warnings ?? []).slice(0, 2).join(" ")}` : result.error);
              if (result.ok) window.location.reload();
            });
          }}
        />
        <Button type="button" onClick={() => fileRef.current?.click()}>
          Upload questions
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await autoTagUntaggedAction(classId);
              if (!result.ok) {
                setMessage(result.error);
                return;
              }
              setProposals(result.results);
              setAiSpend((value) => value + (result.cost ?? 0));
              setMessage(`Tagged ${result.results.length} questions.`);
            })
          }
        >
          Auto-tag untagged
        </Button>
        <Button asChild variant="outline">
          <Link href={`/class/${classId}/questions/generate`}>Generate new</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/class/${classId}/questions/pools`}>Pools</Link>
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-ivory/60">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Show archived
        </label>
      </div>

      {message ? <p className="text-sm text-ivory/70">{message}</p> : null}

      {proposals.length ? (
        <TagReview
          proposals={proposals}
          questions={questions}
          standards={standards}
          concepts={concepts}
          onApprove={(items) =>
            start(async () => {
              const result = await approveTagProposalsAction(classId, items);
              if (!result.ok) {
                setMessage(result.error);
                return;
              }
              setQuestions((prev) =>
                prev.map((question) => {
                  const hit = items.find((item) => item.questionId === question.id);
                  if (!hit) return question;
                  return {
                    ...question,
                    standard_id: hit.standard_id,
                    concept_id: hit.concept_id,
                    difficulty: hit.difficulty,
                    ai_tag_confidence: hit.confidence,
                    ai_tag_reasoning: hit.reasoning,
                    tag_approved: true,
                    standard: standards.find((item) => item.id === hit.standard_id)
                      ? {
                          id: hit.standard_id ?? "",
                          code: standards.find((item) => item.id === hit.standard_id)?.code ?? "",
                          title: standards.find((item) => item.id === hit.standard_id)?.title ?? "",
                        }
                      : question.standard,
                  };
                }),
              );
              setProposals([]);
              setMessage("Tags approved.");
            })
          }
          onSkip={(id) => setProposals((prev) => prev.filter((item) => item.questionId !== id))}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_320px]">
        <aside className="space-y-4 border border-border bg-card p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Filters</p>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stem" />
          <label className="block text-xs text-ivory/55">
            Status
            <select
              className="mt-1 w-full border border-border bg-navy px-2 py-1 text-ivory"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">all</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label className="block text-xs text-ivory/55">
            Source
            <select
              className="mt-1 w-full border border-border bg-navy px-2 py-1 text-ivory"
              value={source}
              onChange={(event) => setSource(event.target.value as typeof source)}
            >
              <option value="all">all</option>
              <option value="imported">imported</option>
              <option value="ai_generated">ai_generated</option>
              <option value="mine">mine</option>
            </select>
          </label>
          <div>
            <p className="text-xs text-ivory/55">Standard</p>
            <div className="mt-1 max-h-56 space-y-1 overflow-y-auto">
              {standardGroups.map((group) => (
                <div key={group.key}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ivory/35">{group.key}</p>
                  {group.items.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-xs text-ivory/80">
                      <input
                        type="checkbox"
                        checked={standardFilter.includes(item.id)}
                        onChange={() =>
                          setStandardFilter((prev) =>
                            prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                          )
                        }
                      />
                      <span>{item.code}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-ivory/55">Concept</p>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {concepts.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-xs text-ivory/80">
                  <input
                    type="checkbox"
                    checked={conceptFilter.includes(item.id)}
                    onChange={() =>
                      setConceptFilter((prev) =>
                        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                      )
                    }
                  />
                  <span>{item.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["easy", "medium", "hard"] as const).map((level) => (
              <label key={level} className="flex items-center gap-1 text-ivory/70">
                <input
                  type="checkbox"
                  checked={difficulty.includes(level)}
                  onChange={() =>
                    setDifficulty((prev) =>
                      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level],
                    )
                  }
                />
                {level}
              </label>
            ))}
          </div>
        </aside>

        <section className="min-w-0 border border-border bg-card">
          {selected.size > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-white/10 px-3 py-2">
              <Button size="sm" onClick={() => start(() => void bulkQuestionAction({ classId, ids: [...selected], action: "approve" }).then(() => window.location.reload()))}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => start(() => void bulkQuestionAction({ classId, ids: [...selected], action: "reject" }).then(() => window.location.reload()))}>
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  start(async () => {
                    const result = await autoTagUntaggedAction(classId);
                    if (result.ok) setProposals(result.results);
                  })
                }
              >
                Tag now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  start(async () => {
                    const name = window.prompt("Pool name", "Level 1 Mock Quiz");
                    if (!name) return;
                    const created = await createPoolAction(classId, name);
                    if (!created.ok) {
                      setMessage(created.error);
                      return;
                    }
                    await addToPoolAction(classId, created.pool.id, [...selected]);
                    setMessage(`Added ${selected.size} questions to ${name}.`);
                  })
                }
              >
                Add to pool
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  start(async () => {
                    await bulkQuestionAction({ classId, ids: [...selected], action: archived ? "restore" : "delete" });
                    window.location.reload();
                  })
                }
              >
                {archived ? "Restore" : "Delete"}
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-ivory/45">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Stem</th>
                  <th className="px-2 py-2">Standard</th>
                  <th className="px-2 py-2">Concept</th>
                  <th className="px-2 py-2">Diff</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((question) => (
                  <tr
                    key={question.id}
                    className={`cursor-pointer border-t border-white/5 ${activeId === question.id ? "bg-gold/10" : ""}`}
                    onClick={() => setActiveId(question.id)}
                  >
                    <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} />
                    </td>
                    <td className="max-w-[280px] truncate px-2 py-2 text-ivory/90">{question.stem}</td>
                    <td className="px-2 py-2 text-ivory/60">{question.standard?.code ?? "—"}</td>
                    <td className="px-2 py-2 text-ivory/60">{question.concept?.title ?? "—"}</td>
                    <td className="px-2 py-2 text-ivory/60">{question.difficulty ?? "—"}</td>
                    <td className="px-2 py-2 text-ivory/60">{question.source}</td>
                    <td className="px-2 py-2 text-ivory/60">
                      {question.deleted_at ? "archived" : question.approved ? "approved" : question.rejected ? "rejected" : "pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <p className="px-3 py-8 text-sm text-ivory/45">No questions match these filters.</p>
            ) : null}
          </div>
        </section>

        <QuestionDrawer
          question={active}
          standards={standards}
          concepts={concepts}
          onSave={(patch) =>
            start(async () => {
              if (!active) return;
              const result = await updateQuestionAction({ classId, id: active.id, ...patch });
              if (!result.ok) setMessage(result.error);
              else window.location.reload();
            })
          }
        />
      </div>
      <p className="text-[11px] text-ivory/40">AI spend for this class: ${aiSpend.toFixed(4)}</p>
    </div>
  );
}

function groupStandards(standards: Standard[]) {
  const groups = new Map<string, Standard[]>();
  for (const item of standards) {
    const key = item.code.split("(")[0] || item.code;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

