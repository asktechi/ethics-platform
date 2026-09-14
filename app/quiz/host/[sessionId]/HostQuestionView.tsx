"use client";

import { cn } from "@/lib/utils";
import type { QuizHostQuestion } from "@/lib/quiz/types";

export function HostQuestionView({
  question,
  phase,
  counts,
  remaining,
  timePerQ,
  paused,
  allAnswered = false,
}: {
  question?: QuizHostQuestion;
  phase: string;
  counts: Record<string, number>;
  remaining: number;
  timePerQ: number;
  paused: boolean;
  allAnswered?: boolean;
}) {
  return (
    <section>
      <h1 className="font-display text-3xl leading-snug">{question?.stem}</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(question?.choices ?? []).map((choice) => {
          const count = counts[choice.key] ?? 0;
          const isCorrect = phase === "reveal" && choice.key === question?.answer_key;
          const isWrong = phase === "reveal" && !isCorrect;
          return (
            <div
              key={choice.key}
              className={cn(
                "min-h-24 border px-4 py-4",
                isCorrect && "border-emerald-400 bg-emerald-900/40",
                isWrong && "border-red-400/60 bg-red-950/30",
                phase !== "reveal" && "border-white/15 bg-card",
              )}
            >
              <p className="text-gold">{choice.key}</p>
              <p className="mt-1 text-lg">{choice.text}</p>
              {phase !== "reveal" ? <p className="mt-2 text-sm text-ivory/50">{count} answers</p> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-6 h-2 overflow-hidden bg-white/10">
        <div
          className="h-full bg-gold transition-[width] duration-200"
          style={{ width: `${Math.max(0, Math.min(100, (remaining / Math.max(1, timePerQ)) * 100))}%` }}
        />
      </div>
      {paused ? <p className="mt-3 text-center text-gold">Paused</p> : null}
      {allAnswered ? <p className="mt-3 text-center text-gold">All answered — revealing…</p> : null}
    </section>
  );
}
