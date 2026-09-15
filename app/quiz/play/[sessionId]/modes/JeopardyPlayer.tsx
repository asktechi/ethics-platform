"use client";

import { MobileAnswerButtons } from "@/components/quiz/player/MobileAnswerButtons";
import { MobilePlayerStage, MobileRevealPanel } from "@/components/quiz/player/MobilePlayerStage";
import { PlayerTimerRing } from "@/components/quiz/player/PlayerTimerRing";
import { cn } from "@/lib/utils";
import type { QuizPlayQuestion } from "@/lib/quiz/types";
import type { ReactNode } from "react";

export function JeopardyPlayer({
  question,
  questionIndex,
  questionCount,
  remaining,
  phase,
  paused,
  choice,
  correctKey,
  explanation,
  lastDelta,
  score,
  streak,
  submitError,
  highlight,
  onLock,
  allowAdvance = false,
  advancePressed = false,
  onAdvance,
  debug = false,
  timeLimit,
  headerBelow,
  headerAbove,
  revealExtra,
  damageFlash,
  questionLabel,
  timerLarge = false,
}: {
  question: QuizPlayQuestion | null;
  questionIndex: number;
  questionCount: number;
  remaining: number;
  phase: string;
  paused: boolean;
  choice: string | null;
  correctKey: string | null;
  explanation: string;
  lastDelta: number | "missed" | null;
  score: number;
  streak: number;
  submitError: string | null;
  highlight: { display_name: string; avatar_color?: string | null; ms_taken: number; points: number } | null;
  onLock: (key: string) => void;
  allowAdvance?: boolean;
  advancePressed?: boolean;
  onAdvance?: () => void;
  debug?: boolean;
  timeLimit?: number;
  headerBelow?: ReactNode;
  headerAbove?: ReactNode;
  revealExtra?: ReactNode;
  damageFlash?: { amount: number; kind: "damage" | "heal" | "party" } | null;
  questionLabel?: string;
  timerLarge?: boolean;
}) {
  const total = timeLimit || question?.time_limit_seconds || remaining || 30;
  const label = questionLabel ?? `Q ${questionIndex + 1} / ${questionCount || "—"}`;
  const correctText = question?.choices.find((item) => item.key.toUpperCase() === (correctKey ?? "").toUpperCase())?.text;
  const lockedFooter =
    phase === "locked" ? (
      <div className="mt-2 space-y-2">
        <p className="text-center text-sm text-ivory/70">Waiting for others…</p>
        {allowAdvance ? (
          <button
            type="button"
            disabled={advancePressed}
            onClick={onAdvance}
            className="min-h-12 w-full touch-manipulation border border-gold/40 bg-navy px-4 py-2 text-sm font-medium text-gold disabled:opacity-60"
          >
            {advancePressed ? "Ready — waiting for the host" : "Ready for next"}
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <div className="hidden min-h-0 flex-1 flex-col md:flex" data-player-stage="desktop">
        {paused ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-navy/85">
            <p className="font-display text-3xl text-gold">Paused by host</p>
          </div>
        ) : null}
        {highlight ? (
          <div className="mb-3 border border-gold/50 bg-gold/10 px-3 py-2 text-sm">
            Fastest: {highlight.display_name} · {(highlight.ms_taken / 1000).toFixed(1)}s · {highlight.points} pts
          </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-between text-xs uppercase tracking-[0.14em] text-ivory/45">
          <span>
            Question {questionIndex + 1} of {questionCount || "—"}
          </span>
          <span className="font-mono text-lg tabular-nums text-gold">{remaining}s</span>
        </div>
        <h1 className="mt-3 max-h-[22vh] shrink-0 overflow-y-auto font-display text-xl leading-snug">{question?.stem}</h1>
        <div className="mt-4 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
          {(question?.choices ?? []).map((item) => {
            const selected = choice === item.key;
            const isCorrect = correctKey === item.key;
            const isWrong = phase === "reveal" && selected && !isCorrect;
            return (
              <button
                key={item.key}
                type="button"
                disabled={phase !== "question" || paused}
                onClick={() => onLock(item.key)}
                className={cn(
                  "min-h-14 rounded-md border px-3 py-3 text-left text-base font-medium",
                  phase === "question" && "border-ivory/20 bg-card active:bg-gold active:text-navy",
                  selected && phase !== "reveal" && "border-gold bg-gold/20",
                  phase === "reveal" && isCorrect && "border-emerald-400 bg-emerald-900/50",
                  isWrong && "border-red-400 bg-red-900/50",
                )}
              >
                <span className="mr-3 text-gold">{item.key}</span>
                {item.text}
              </button>
            );
          })}
        </div>
        <div className="mt-3 shrink-0 border border-white/10 bg-card p-3 text-center">
          {phase === "question" ? <p className="text-sm text-ivory/60">Tap an answer before the timer hits 0.</p> : null}
          {phase === "locked" ? (
            <div className="space-y-3">
              <p className="text-sm text-ivory/80">Waiting for others…</p>
              {allowAdvance ? (
                <button
                  type="button"
                  disabled={advancePressed}
                  onClick={onAdvance}
                  className="w-full border border-gold/40 bg-navy px-4 py-2 text-sm font-medium text-gold disabled:opacity-60"
                >
                  {advancePressed ? "Ready — waiting for the host" : "Ready for next"}
                </button>
              ) : null}
            </div>
          ) : null}
          {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
          {phase === "reveal" ? (
            <div className="text-left">
              <p className="font-display text-2xl text-gold">
                {lastDelta === "missed" ? "Missed" : lastDelta === 0 ? "+0" : `+${lastDelta}`}
              </p>
              <p className="text-sm text-ivory/70">
                Score {score} · streak {streak}
              </p>
              {explanation ? <p className="mt-2 max-h-24 overflow-y-auto text-sm text-ivory/80">{explanation}</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <MobilePlayerStage
          debug={debug}
          paused={paused}
          headerLeft={<span className="truncate">{label}</span>}
          headerCenter={
            timerLarge ? (
              <span className="font-mono text-2xl tabular-nums text-gold">{remaining}s</span>
            ) : (
              <PlayerTimerRing remaining={remaining} total={total} />
            )
          }
          headerRight={<span>{score}</span>}
          headerAbove={headerAbove}
          headerBelow={headerBelow}
          questionKey={question?.question_id ?? questionIndex}
          question={
            <>
              {highlight ? (
                <p className="mb-3 text-sm text-gold">
                  Fastest: {highlight.display_name} · {(highlight.ms_taken / 1000).toFixed(1)}s
                </p>
              ) : null}
              <p>{question?.stem}</p>
              {submitError ? <p className="mt-3 text-sm text-red-300">{submitError}</p> : null}
            </>
          }
          revealPanel={
            phase === "reveal" ? (
              <MobileRevealPanel
                lastDelta={lastDelta}
                correctKey={correctKey}
                correctText={correctText}
                explanation={explanation}
                extra={
                  <p className="mt-2 text-sm text-ivory/60">
                    {lastDelta === "missed" || lastDelta === 0 ? "+0" : `+${lastDelta}`} · {score} pts · streak {streak}
                    {revealExtra}
                  </p>
                }
                damage={damageFlash}
              />
            ) : null
          }
          answers={
            <>
              <MobileAnswerButtons
                choices={question?.choices ?? []}
                phase={phase === "locked" ? "question" : phase}
                choice={choice}
                correctKey={correctKey}
                onLock={onLock}
                disabled={paused || phase === "locked" || phase === "reveal"}
              />
              {lockedFooter}
            </>
          }
        />
      </div>
    </>
  );
}
