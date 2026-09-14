"use client";

import { useEffect, useState } from "react";
import { JeopardyPlayer } from "@/app/quiz/play/[sessionId]/modes/JeopardyPlayer";
import { BrandNavLink } from "@/components/quiz/EndNavBar";
import { cn } from "@/lib/utils";
import type { QuizPlayQuestion } from "@/lib/quiz/types";

export function CaseStudyPlayer({
  intro,
  complete,
  ready,
  onReady,
  caseTitle,
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
}: {
  intro: { title: string; scenario: string } | null;
  complete: boolean;
  ready: boolean;
  onReady: () => void;
  caseTitle: string | null;
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
}) {
  const [holdComplete, setHoldComplete] = useState(complete);

  useEffect(() => {
    if (!complete) {
      setHoldComplete(false);
      return;
    }
    setHoldComplete(true);
    const timer = window.setTimeout(() => setHoldComplete(false), 2000);
    return () => window.clearTimeout(timer);
  }, [complete]);

  if (intro && !ready) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-navy text-ivory">
        <p className="text-xs uppercase tracking-[0.18em] text-[#2A9D8F]">Case study</p>
        <h1 className="mt-3 font-display text-3xl">{intro.title}</h1>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-ivory/80">
          {intro.scenario}
        </div>
        <button
          type="button"
          onClick={onReady}
          className="mt-4 bg-gold px-4 py-3 font-medium text-navy hover:bg-gold/90"
        >
          I&apos;m ready
        </button>
      </div>
    );
  }

  if (holdComplete) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border border-[#2A9D8F]/40 bg-[#2A9D8F]/10 px-6 py-8 text-center">
          <p className="font-display text-3xl text-[#2A9D8F]">Case complete</p>
          <p className="mt-2 text-ivory/70">Nice work</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <BrandNavLink href="/quiz/join">Back to Home</BrandNavLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {caseTitle ? (
        <p className={cn("mb-2 text-xs uppercase tracking-[0.14em] text-[#2A9D8F]")}>Case: {caseTitle}</p>
      ) : null}
      <JeopardyPlayer
        question={question}
        questionIndex={questionIndex}
        questionCount={questionCount}
        remaining={remaining}
        phase={phase}
        paused={paused}
        choice={choice}
        correctKey={correctKey}
        explanation={explanation}
        lastDelta={lastDelta}
        score={score}
        streak={streak}
        submitError={submitError}
        highlight={highlight}
        onLock={onLock}
        allowAdvance={allowAdvance}
        advancePressed={advancePressed}
        onAdvance={onAdvance}
      />
    </>
  );
}
