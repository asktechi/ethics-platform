"use client";

import { BestAnswerPanel, type BestAnswer } from "@/components/quiz/BestAnswerPanel";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { ResponseDistribution } from "@/components/quiz/ResponseDistribution";
import { Button } from "@/components/ui/button";
import type { QuizHostQuestion } from "@/lib/quiz/types";
import type { ReactNode } from "react";

export function HostSidePanel({
  players,
  changedIds,
  joins,
  question,
  counts,
  revealed,
  best,
  onHighlight,
  extra,
  footer,
  onAddBot,
}: {
  players: LivePlayer[];
  changedIds: Set<string>;
  joins: string[];
  question?: QuizHostQuestion;
  counts: Record<string, number>;
  revealed: boolean;
  best: BestAnswer | null;
  onHighlight: () => void;
  extra?: ReactNode;
  footer?: ReactNode;
  onAddBot?: () => void;
}) {
  return (
    <aside className="space-y-4 border border-white/10 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Live</p>
        {onAddBot ? (
          <Button size="sm" variant="outline" onClick={onAddBot}>
            Add bot
          </Button>
        ) : null}
      </div>
      {extra}
      <Leaderboard players={players} changedIds={changedIds} compact />
      <div>
        <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ivory/45">Recent joins</p>
        {joins.length === 0 ? <p className="text-xs text-ivory/40">No new joins yet.</p> : null}
        <ul className="space-y-1 text-xs text-ivory/60">
          {joins.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <ResponseDistribution
        choices={question?.choices ?? []}
        counts={counts}
        revealed={revealed}
        correctKey={question?.answer_key ?? null}
      />
      {revealed ? <BestAnswerPanel best={best} onShow={onHighlight} /> : null}
      {footer}
    </aside>
  );
}
