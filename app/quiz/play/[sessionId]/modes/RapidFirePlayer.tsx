"use client";

import { useEffect, useRef, useState } from "react";
import { submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import type { PlayerIdentity, QuizPlayQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

export function RapidFirePlayer({
  identity,
  questions,
  remaining,
  frozen,
  skipIndex,
  onDelta,
}: {
  identity: PlayerIdentity;
  questions: QuizPlayQuestion[];
  remaining: number;
  frozen: boolean;
  skipIndex: number;
  onDelta: (delta: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const question = questions[index] ?? null;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (skipIndex >= 0 && index <= skipIndex) {
      setIndex(Math.min(skipIndex + 1, questions.length));
      setChoice(null);
      setFlash(null);
      setBusy(false);
    }
  }, [index, questions.length, skipIndex]);

  async function pick(key: string) {
    if (!question || busy || frozen) return;
    setBusy(true);
    setChoice(key);
    const result = await submitAnswerAction({
      token: identity.participant_token,
      questionId: question.question_id,
      choiceKey: key,
      msTaken: Date.now() - shownAt.current,
    });
    if (!result.ok) {
      setBusy(false);
      setChoice(null);
      return;
    }
    const correct = Boolean(result.isCorrect);
    setFlash(correct ? "correct" : "wrong");
    setDelta(result.points);
    onDelta(result.points ?? 0);
    window.setTimeout(() => {
      setFlash(null);
      setDelta(null);
      setChoice(null);
      setBusy(false);
      setIndex((value) => Math.min(value + 1, questions.length));
    }, 400);
  }

  if (frozen) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-display text-4xl text-gold">Time</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <div>
          <p className="font-display text-3xl">Queue complete</p>
          <p className="mt-2 text-ivory/60">Wait for the clock to finish.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between text-xs uppercase tracking-[0.14em] text-ivory/45">
        <span>
          Question {index + 1}
          {questions.length ? ` of ${questions.length}` : ""}
        </span>
        <span className="font-mono text-lg tabular-nums text-gold">{remaining}s</span>
      </div>
      <h1 className="mt-3 max-h-[22vh] shrink-0 overflow-y-auto font-display text-xl leading-snug">{question.stem}</h1>
      <div className="mt-4 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
        {question.choices.map((item) => {
          const selected = choice === item.key;
          return (
            <button
              key={item.key}
              type="button"
              disabled={busy || frozen}
              onClick={() => void pick(item.key)}
              className={cn(
                "min-h-14 rounded-md border px-3 py-3 text-left text-base font-medium",
                "border-ivory/20 bg-card active:bg-gold active:text-navy",
                selected && flash === "correct" && "border-emerald-400 bg-emerald-900/50",
                selected && flash === "wrong" && "border-red-400 bg-red-900/50",
              )}
            >
              <span className="mr-3 text-gold">{item.key}</span>
              {item.text}
            </button>
          );
        })}
      </div>
      <div className="mt-3 shrink-0 border border-white/10 bg-card p-3 text-center">
        {delta != null && delta > 0 ? (
          <p className="font-display text-2xl text-gold">+{delta}</p>
        ) : (
          <p className="text-sm text-ivory/60">Tap as fast as you can. The clock never stops.</p>
        )}
      </div>
    </>
  );
}
