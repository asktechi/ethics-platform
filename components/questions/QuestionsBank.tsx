"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  approveTagProposalsAction,
  autoTagUntaggedAction,
  bulkQuestionAction,
  countMatchingQuestionsAction,
  listMatchingQuestionIdsAction,
  updateQuestionAction,
} from "@/app/(app)/_actions/question.actions";
import { addToPoolAction, createPoolWithQuestionsAction, listPoolsAction } from "@/app/(app)/_actions/question-pool.actions";
import { QuestionDrawer } from "@/components/questions/QuestionDrawer";
import { QuickSelect } from "@/components/questions/QuickSelect";
import { TagReview } from "@/components/questions/TagReview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { QuestionRow } from "@/lib/data/questions";
import type { PoolRow } from "@/lib/data/question-pools";
import {
  PAGE_SIZE,
  headerSelectState,
  pageSlice,
  railFilters,
  replaceIds,
  togglePageIds,
  unionIds,
} from "@/lib/questions/selection";
import type { Concept, Standard } from "@/types/db.helpers";
import { cn } from "@/lib/utils";

export function QuestionsBank({
  classId,
  initialQuestions,
  standards,
  concepts,
  pools: initialPools = [],
  spend,
  importedCount = 0,
}: {
  classId: string;
  initialQuestions: QuestionRow[];
  standards: Standard[];
  concepts: Concept[];
  pools?: PoolRow[];
  spend: number;
  importedCount?: number;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [pools, setPools] = useState(initialPools);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [source, setSource] = useState<"all" | "imported" | "ai_generated" | "mine">("all");
  const [standardFilter, setStandardFilter] = useState<string[]>([]);
  const [conceptFilter, setConceptFilter] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(0);
  const [matchingCount, setMatchingCount] = useState(0);
  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [poolName, setPoolName] = useState("Full Mix");
  const [poolShuffle, setPoolShuffle] = useState(true);
  const [poolTime, setPoolTime] = useState("45");
  const headerRef = useRef<HTMLInputElement>(null);
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
  const [message, setMessage] = useState<string | null>(
    importedCount > 0 ? `${importedCount} questions imported. Start auto-tagging?` : null,
  );
  const [aiSpend, setAiSpend] = useState(spend);
  const [pending, start] = useTransition();

  const filters = useMemo(
    () =>
      railFilters({
        search,
        status,
        source,
        standardFilter,
        conceptFilter,
        difficulty,
        archived,
      }),
    [archived, conceptFilter, difficulty, search, source, standardFilter, status],
  );

  const visible = useMemo(
    () =>
      questions.filter((question) => {
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
      }),
    [archived, conceptFilter, difficulty, questions, search, source, standardFilter, status],
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = pageSlice(visible, safePage);
  const pageIds = pageRows.map((row) => row.id);
  const headerState = headerSelectState(pageIds, selected);
  const selectedInVisible = visible.filter((row) => selected.has(row.id)).length;
  const active = questions.find((question) => question.id === activeId) ?? null;
  const standardGroups = groupStandards(standards);
  const selectedIds = [...selected];

  useEffect(() => {
    setPage(0);
  }, [search, status, source, standardFilter, conceptFilter, difficulty, archived]);

  useEffect(() => {
    if (initialPools.length) setPools(initialPools);
  }, [initialPools]);

  const refreshPools = useCallback(async () => {
    const result = await listPoolsAction(classId);
    if (result.ok) setPools(result.pools);
    else setMessage(result.error);
    return result;
  }, [classId]);

  useEffect(() => {
    void refreshPools();
  }, [refreshPools]);

  useEffect(() => {
    let cancelled = false;
    start(async () => {
      const result = await countMatchingQuestionsAction(classId, filters);
      if (!cancelled && result.ok) setMatchingCount(result.count);
    });
    return () => {
      cancelled = true;
    };
  }, [classId, filters]);

  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = headerState === "some";
  }, [headerState]);

  const selectMatching = useCallback(() => {
    start(async () => {
      const result = await listMatchingQuestionIdsAction(classId, filters);
      if (result.ok) setSelected(replaceIds(result.ids));
    });
  }, [classId, filters]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectMatching();
      }
      if (event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setSelected(new Set());
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelected(replaceIds(pageIds));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageIds, selectMatching]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onHeaderChange() {
    setSelected((prev) => togglePageIds(prev, pageIds, headerState));
  }

  function applyBulk(action: "approve" | "reject" | "delete" | "restore") {
    if (selectedIds.length === 0) {
      setMessage("Check one or more questions first.");
      return;
    }
    start(async () => {
      const result = await bulkQuestionAction({ classId, ids: selectedIds, action });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const stamp = new Date().toISOString();
      setQuestions((prev) =>
        prev.map((question) => {
          if (!selected.has(question.id)) return question;
          if (action === "approve") return { ...question, approved: true, rejected: false };
          if (action === "reject") return { ...question, approved: false, rejected: true };
          if (action === "delete") return { ...question, deleted_at: stamp };
          return { ...question, deleted_at: null };
        }),
      );
      const count = selectedIds.length;
      setSelected(new Set());
      if (action === "approve") {
        setMessage(`Approved ${count} question${count === 1 ? "" : "s"}. They can now go into a pool and launch.`);
      } else if (action === "reject") {
        setMessage(`Rejected ${count} question${count === 1 ? "" : "s"}.`);
      } else if (action === "delete") {
        setMessage(`Archived ${count} question${count === 1 ? "" : "s"}.`);
      } else {
        setMessage(`Restored ${count} question${count === 1 ? "" : "s"}.`);
      }
    });
  }

  async function addSelectedToPool(pool: PoolRow) {
    if (selectedIds.length === 0) {
      setMessage("Check one or more questions first.");
      return;
    }
    const result = await addToPoolAction(classId, pool.id, selectedIds);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    await refreshPools();
    setPoolDialogOpen(false);
    setMessage(`Added ${result.added ?? selectedIds.length} questions to ${pool.name}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/class/${classId}/questions/import`}>Upload questions</Link>
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

      {message ? (
        <p className={cn("text-sm", /fail|error|invalid|not authorized|check one/i.test(message) ? "text-red-300" : "text-ivory/70")}>
          {message}{" "}
          {message.toLowerCase().includes("pool") ? (
            <Link href={`/class/${classId}/questions/pools`} className="text-gold underline">
              Open pools
            </Link>
          ) : null}
        </p>
      ) : null}

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

      {selected.size > 0 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border border-gold bg-navy px-3 py-2 text-sm text-ivory">
          <span>
            {selected.size} selected ({selectedInVisible} in view)
          </span>
          {selected.size < matchingCount ? (
            <button type="button" className="text-gold underline" onClick={selectMatching}>
              Select all {matchingCount} matching
            </button>
          ) : null}
          <button type="button" className="text-ivory/70 underline" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_320px]">
        <aside className="space-y-4 border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Filters</p>
            <QuickSelect
              classId={classId}
              standards={standards}
              concepts={concepts}
              selected={selected}
              onChange={setSelected}
            />
          </div>
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
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            <Button size="sm" disabled={pending || selected.size === 0} onClick={() => applyBulk("approve")}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={pending || selected.size === 0} onClick={() => applyBulk("reject")}>
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selected.size === 0}
              onClick={() =>
                start(async () => {
                  const result = await autoTagUntaggedAction(classId, selectedIds);
                  if (result.ok) {
                    setProposals(result.results);
                    setAiSpend((value) => value + (result.cost ?? 0));
                  } else setMessage(result.error);
                })
              }
            >
              Tag now
            </Button>
            <Button
              size="sm"
              className="bg-gold text-navy hover:bg-gold/90"
              disabled={pending}
              onClick={() => {
                void refreshPools();
                setPoolDialogOpen(true);
              }}
            >
              Add to pool
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending || selected.size === 0}
              onClick={() => applyBulk(archived ? "restore" : "delete")}
            >
              {archived ? "Restore" : "Delete"}
            </Button>
            {selected.size === 0 ? (
              <span className="text-xs text-ivory/45">Check questions, then approve or add them to a pool.</span>
            ) : (
              <span className="text-xs text-ivory/60">{selected.size} selected</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-ivory/45">
                <tr>
                  <th className="relative px-2 py-2">
                    <input
                      ref={headerRef}
                      type="checkbox"
                      checked={headerState === "all" && pageIds.length > 0}
                      onChange={onHeaderChange}
                      aria-label="Select this page"
                    />
                  </th>
                  <th className="px-2 py-2">Stem</th>
                  <th className="px-2 py-2">Standard</th>
                  <th className="px-2 py-2">Concept</th>
                  <th className="px-2 py-2">Diff</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((question) => (
                  <tr
                    key={question.id}
                    className={cn(
                      "cursor-pointer border-t border-white/5",
                      selected.has(question.id) && "bg-[#C9A227]/10",
                      activeId === question.id && "bg-gold/10",
                    )}
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
          {visible.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs text-ivory/60">
              <span>
                Page {safePage + 1} of {pageCount} · {visible.length} matching
                {matchingCount > pageIds.length ? (
                  <>
                    {" · "}
                    <button type="button" className="text-gold underline" onClick={selectMatching}>
                      Select all {matchingCount} matching
                    </button>
                  </>
                ) : null}
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <p className="border-t border-white/10 px-3 py-2 text-xs text-ivory/45">{visible.length} matching current filters</p>
          )}
        </section>

        <QuestionDrawer
          question={active}
          standards={standards}
          concepts={concepts}
          onSave={(patch) =>
            start(async () => {
              if (!active) return;
              const result = await updateQuestionAction({ classId, id: active.id, ...patch });
              if (!result.ok) {
                setMessage(result.error);
                return;
              }
              const id = active.id;
              setQuestions((prev) =>
                prev.map((question) => {
                  if (question.id !== id) return question;
                  const next = { ...question, ...patch };
                  if (patch.standard_id !== undefined) {
                    const standard = standards.find((item) => item.id === patch.standard_id);
                    next.standard = standard
                      ? { id: standard.id, code: standard.code, title: standard.title }
                      : null;
                  }
                  if (patch.concept_id !== undefined) {
                    const concept = concepts.find((item) => item.id === patch.concept_id);
                    next.concept = concept ? { id: concept.id, title: concept.title } : null;
                  }
                  return next;
                }),
              );
              setMessage(patch.approved ? "Question approved." : patch.rejected ? "Question rejected." : "Question saved.");
            })
          }
        />
      </div>
      <p className="text-[11px] text-ivory/40">AI spend for this class: ${aiSpend.toFixed(4)}</p>

      <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
        <DialogContent className="border-border bg-navy text-ivory">
          <DialogHeader>
            <DialogTitle>Add to a pool</DialogTitle>
          </DialogHeader>
          {selected.size === 0 ? (
            <p className="text-sm text-ivory/70">Check one or more questions in the bank, then open this again.</p>
          ) : (
            <p className="text-sm text-ivory/70">
              Add {selected.size} selected question{selected.size === 1 ? "" : "s"} to an existing pool, or create one.
              Approve them if you want the pool to be playable.
            </p>
          )}
          {pools.length ? (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {pools.map((pool) => (
                <button
                  key={pool.id}
                  type="button"
                  disabled={pending || selected.size === 0}
                  className="block w-full border border-white/10 px-3 py-2 text-left text-sm text-ivory hover:bg-gold/10 disabled:opacity-40"
                  onClick={() => start(() => addSelectedToPool(pool))}
                >
                  {pool.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ivory/55">No pools yet. Create one below.</p>
          )}
          <div className="space-y-3 border-t border-white/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">New pool</p>
            <label className="block text-sm">
              Name
              <Input className="mt-1" value={poolName} onChange={(event) => setPoolName(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={poolShuffle} onChange={(event) => setPoolShuffle(event.target.checked)} />
              Shuffle on play
            </label>
            <label className="block text-sm">
              Seconds per question
              <Input className="mt-1" value={poolTime} onChange={(event) => setPoolTime(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPoolDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-gold text-navy hover:bg-gold/90"
              disabled={pending || selected.size === 0}
              onClick={() =>
                start(async () => {
                  const time = Number(poolTime);
                  const result = await createPoolWithQuestionsAction({
                    classId,
                    name: poolName,
                    questionIds: selectedIds,
                    shuffle_on_play: poolShuffle,
                    time_per_q: Number.isFinite(time) && time > 0 ? time : null,
                  });
                  if (!result.ok) {
                    setMessage(result.error);
                    return;
                  }
                  setPools((current) => [result.pool, ...current.filter((item) => item.id !== result.pool.id)]);
                  setPoolDialogOpen(false);
                  setMessage(`Created ${result.pool.name} with ${selected.size} questions.`);
                })
              }
            >
              Create and add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
