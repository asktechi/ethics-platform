"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { countMatchingQuestionsAction, listMatchingQuestionIdsAction } from "@/app/(app)/_actions/question.actions";
import { Button } from "@/components/ui/button";
import type { QuestionFilters } from "@/lib/data/questions";
import { replaceIds, unionIds } from "@/lib/questions/selection";
import type { Concept, Standard } from "@/types/db.helpers";
import { cn } from "@/lib/utils";

type Props = {
  classId: string;
  standards: Standard[];
  concepts: Concept[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

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

export function QuickSelect({ classId, standards, concepts, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [standardIds, setStandardIds] = useState<string[]>([]);
  const [conceptIds, setConceptIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [source, setSource] = useState<Array<"imported" | "ai_generated">>([]);
  const [status, setStatus] = useState<Array<"pending" | "approved" | "rejected">>([]);
  const [minConfidence, setMinConfidence] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const groups = useMemo(() => groupStandards(standards), [standards]);

  const filters: QuestionFilters = useMemo(
    () => ({
      standardIds,
      conceptIds,
      difficulty: difficulty as QuestionFilters["difficulty"],
      sources: source.length ? source : undefined,
      statuses: status.length ? status : undefined,
      minConfidence: minConfidence > 0 ? minConfidence : null,
      includeArchived: false,
    }),
    [conceptIds, difficulty, minConfidence, source, standardIds, status],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      start(async () => {
        const result = await countMatchingQuestionsAction(classId, filters);
        if (!cancelled && result.ok) setPreview(result.count);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [classId, filters, open]);

  function toggleList<T extends string>(value: T, list: T[], setList: (next: T[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function apply(mode: "replace" | "add") {
    start(async () => {
      const result = await listMatchingQuestionIdsAction(classId, filters);
      if (!result.ok) return;
      onChange(mode === "add" ? unionIds(selected, result.ids) : replaceIds(result.ids));
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
        Quick select
      </Button>
      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[min(100vw-2rem,360px)] space-y-3 border border-gold/40 bg-navy p-3 shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Select by</p>
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
            <p className="text-ivory/55">Standard</p>
            {groups.map((group) => (
              <div key={group.key}>
                <label className="flex items-center gap-2 text-ivory/80">
                  <input
                    type="checkbox"
                    checked={group.items.every((item) => standardIds.includes(item.id))}
                    onChange={() => {
                      const ids = group.items.map((item) => item.id);
                      const allOn = ids.every((id) => standardIds.includes(id));
                      setStandardIds(allOn ? standardIds.filter((id) => !ids.includes(id)) : [...new Set([...standardIds, ...ids])]);
                    }}
                  />
                  <span className="font-medium">{group.key}</span>
                </label>
                <div className="ml-5 space-y-1">
                  {group.items.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-ivory/70">
                      <input
                        type="checkbox"
                        checked={standardIds.includes(item.id)}
                        onChange={() => toggleList(item.id, standardIds, setStandardIds)}
                      />
                      {item.code}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="max-h-28 space-y-1 overflow-y-auto text-xs">
            <p className="text-ivory/55">Concept</p>
            {concepts.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-ivory/70">
                <input
                  type="checkbox"
                  checked={conceptIds.includes(item.id)}
                  onChange={() => toggleList(item.id, conceptIds, setConceptIds)}
                />
                {item.title}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["easy", "medium", "hard"] as const).map((level) => (
              <label key={level} className="flex items-center gap-1 text-ivory/70">
                <input type="checkbox" checked={difficulty.includes(level)} onChange={() => toggleList(level, difficulty, setDifficulty)} />
                {level}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["imported", "ai_generated"] as const).map((item) => (
              <label key={item} className="flex items-center gap-1 text-ivory/70">
                <input type="checkbox" checked={source.includes(item)} onChange={() => toggleList(item, source, setSource)} />
                {item}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["pending", "approved", "rejected"] as const).map((item) => (
              <label key={item} className="flex items-center gap-1 text-ivory/70">
                <input type="checkbox" checked={status.includes(item)} onChange={() => toggleList(item, status, setStatus)} />
                {item}
              </label>
            ))}
          </div>
          <label className="block text-xs text-ivory/55">
            Score / confidence ≥ {minConfidence.toFixed(2)}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(event) => setMinConfidence(Number(event.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <p className="text-sm text-ivory/80">
            Preview: {pending && preview == null ? "Counting…" : `This will select ${preview ?? 0} questions.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="bg-gold text-navy hover:bg-gold/90" disabled={pending} onClick={() => apply("replace")}>
              Apply selection
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => apply("add")}>
              Add to selection
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => apply("replace")}>
              Replace selection
            </Button>
          </div>
          <button type="button" className={cn("text-xs text-ivory/45 underline")} onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
