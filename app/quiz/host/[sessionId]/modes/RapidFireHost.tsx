"use client";

import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { Button } from "@/components/ui/button";
import type { HostExtraPanelProps } from "@/lib/games/modes/types";
import { cn } from "@/lib/utils";

export function RapidFireHost({
  questions,
  index,
  remaining,
  players,
  responses,
  onSkip,
}: HostExtraPanelProps) {
  const top5 = [...players].sort((a, b) => b.score - a.score).slice(0, 5) as LivePlayer[];
  const correctByPlayer = new Map<string, number>();
  for (const row of responses) {
    if (row.is_correct) correctByPlayer.set(row.participant_id, (correctByPlayer.get(row.participant_id) ?? 0) + 1);
  }

  return (
    <section className="space-y-4">
      <div className="border border-gold/40 bg-gold/10 px-4 py-6 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Shared clock</p>
        <p className="mt-2 font-mono text-7xl tabular-nums text-gold">{remaining}s</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-white/10 bg-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Question queue</p>
            <Button size="sm" variant="outline" onClick={() => onSkip?.()}>
              Skip
            </Button>
          </div>
          <ol className="max-h-[52vh] space-y-2 overflow-auto">
            {questions.map((question, qIndex) => {
              const answered = responses.filter((row) => row.question_id === question.question_id).length;
              const active = qIndex === index;
              return (
                <li
                  key={question.question_id}
                  className={cn(
                    "border px-3 py-2 text-sm",
                    active ? "border-gold bg-gold/10" : "border-white/10",
                    qIndex < index && "opacity-50",
                  )}
                >
                  <p className="text-xs text-ivory/45">
                    Q{qIndex + 1} · {answered} answered
                  </p>
                  <p className="mt-1 line-clamp-2">{question.stem}</p>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="border border-white/10 bg-card p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold">Live top 5</p>
          <Leaderboard players={top5} compact />
          <ul className="mt-3 space-y-1 text-xs text-ivory/55">
            {top5.map((player) => (
              <li key={player.id}>
                {player.display_name}: {correctByPlayer.get(player.id) ?? 0} correct
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
