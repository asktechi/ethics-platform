"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRehearsalAction } from "@/app/(app)/_actions/rehearsal.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BotProfile, QuestionScope } from "@/lib/games/rehearsal/types";

const COUNTS = [1, 3, 5, 10] as const;
const BEHAVIORS: Array<{ id: BotProfile | "random"; label: string; hint: string }> = [
  { id: "perfect", label: "Perfect", hint: "all correct" },
  { id: "mixed", label: "Mixed", hint: "70% correct" },
  { id: "struggler", label: "Struggler", hint: "40% correct" },
  { id: "random", label: "Random", hint: "50% correct" },
];

export function RehearseModal({
  open,
  onOpenChange,
  templateId,
  questionCount,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  questionCount: number;
  onBlocked: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [botCount, setBotCount] = useState<(typeof COUNTS)[number]>(3);
  const [behaviors, setBehaviors] = useState<Set<BotProfile | "random">>(new Set(["mixed"]));
  const [fastForward, setFastForward] = useState(true);
  const [scope, setScope] = useState<"all" | "first_5" | "custom">("all");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(5, questionCount || 5));

  function questionScope(): QuestionScope {
    if (scope === "first_5") return "first_5";
    if (scope === "custom") return { from, to };
    return "all";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card text-ivory">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Rehearse this game</DialogTitle>
          <DialogDescription className="text-ivory/65">
            Practice with simulated students. Nothing is saved to sessions or analytics.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold">Number of simulated students</p>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`border px-3 py-1 ${botCount === count ? "border-gold bg-gold/15 text-gold" : "border-white/15"}`}
                  onClick={() => setBotCount(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold">Bot behavior</p>
            <div className="space-y-2">
              {BEHAVIORS.map((item) => (
                <label key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={behaviors.has(item.id)}
                    onChange={() => {
                      setBehaviors((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        if (next.size === 0) next.add("mixed");
                        return next;
                      });
                    }}
                  />
                  <span>
                    {item.label} <span className="text-ivory/45">({item.hint})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fastForward} onChange={(event) => setFastForward(event.target.checked)} />
            Fast-forward timers (5s instead of the live limit)
          </label>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold">Questions to rehearse</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["first_5", "First 5"],
                  ["custom", "Custom range"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`border px-3 py-1 ${scope === key ? "border-gold bg-gold/15 text-gold" : "border-white/15"}`}
                  onClick={() => setScope(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {scope === "custom" ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={questionCount}
                  value={from}
                  onChange={(event) => setFrom(Number(event.target.value))}
                  className="h-9 w-20 border border-border bg-navy px-2"
                />
                <span>to</span>
                <input
                  type="number"
                  min={1}
                  max={questionCount}
                  value={to}
                  onChange={(event) => setTo(Number(event.target.value))}
                  className="h-9 w-20 border border-border bg-navy px-2"
                />
              </div>
            ) : null}
          </div>
          {error ? <p className="text-red-300">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-navy hover:bg-gold/90"
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const profiles = [...behaviors];
                const bot_profiles = profiles.includes("random") && profiles.length === 1 ? "random" : profiles.filter((item) => item !== "random");
                const result = await startRehearsalAction({
                  templateId,
                  bot_count: botCount,
                  bot_profiles: bot_profiles.length ? bot_profiles : ["mixed"],
                  fast_forward: fastForward,
                  question_scope: questionScope(),
                });
                if (!result.ok) {
                  if ("cannotStart" in result && result.cannotStart) {
                    onOpenChange(false);
                    onBlocked(result.error);
                    return;
                  }
                  setError(result.error);
                  return;
                }
                router.push(`/quiz/host/${result.sessionId}?rehearsal=1`);
              });
            }}
          >
            Start rehearsal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
