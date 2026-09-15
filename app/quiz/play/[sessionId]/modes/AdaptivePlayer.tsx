"use client";

import { useEffect, useRef, useState } from "react";
import { nextAdaptiveQuestionAction, submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import { MobileAnswerButtons } from "@/components/quiz/player/MobileAnswerButtons";
import { MobilePlayerStage, MobileRevealPanel } from "@/components/quiz/player/MobilePlayerStage";
import type { PlayerIdentity } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

type PlayQuestion = {
  question_id: string;
  stem: string;
  choices: Array<{ key: string; text: string }>;
  time_limit_seconds: number;
  standard_id: string | null;
  standard_code: string | null;
  standard_title: string | null;
  question_index: number;
  total_questions: number;
  finished: boolean;
};

export function AdaptivePlayer({
  identity,
  sessionId,
  started,
  allowHint,
  onDelta,
  onProgress,
  debug = false,
}: {
  identity: PlayerIdentity;
  sessionId: string;
  started: boolean;
  allowHint: boolean;
  onDelta: (delta: number) => void;
  onProgress?: (payload: { question_index: number; standard_id: string | null }) => void;
  debug?: boolean;
}) {
  const [question, setQuestion] = useState<PlayQuestion | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const shownAt = useRef(Date.now());

  async function loadNext() {
    const result = await nextAdaptiveQuestionAction(identity.participant_token);
    if (!result.ok) return;
    if (result.question.finished || !result.question.question_id) {
      setFinished(true);
      setQuestion(null);
      return;
    }
    setQuestion(result.question);
    setChoice(null);
    setFlash(null);
    setDelta(null);
    setHint(null);
    setHintError(null);
    setBusy(false);
    shownAt.current = Date.now();
    onProgress?.({
      question_index: result.question.question_index,
      standard_id: result.question.standard_id,
    });
  }

  useEffect(() => {
    if (!started) return;
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  async function pick(key: string) {
    if (!question || busy || finished) return;
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
      void loadNext();
    }, 800);
  }

  async function requestHint() {
    if (!question || hint) return;
    setHintError(null);
    const response = await fetch("/api/quiz/adaptive/hint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        participant_token: identity.participant_token,
        question_id: question.question_id,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { hint?: string; points_cost?: number; error?: string };
    if (!response.ok) {
      setHintError(body.error ?? "Hint unavailable.");
      return;
    }
    setHint(body.hint ?? "");
    onDelta(-(body.points_cost ?? 50));
  }

  if (!started) {
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#4C8BF5]">Adaptive drill</p>
          <h1 className="mt-3 font-display text-3xl">Waiting for the host to start</h1>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-1 items-center justify-center text-center">
        <div>
          <p className="font-display text-4xl text-[#4C8BF5]">Drill complete</p>
          <p className="mt-3 text-ivory/70">You&apos;ve finished the drill. Your score is frozen.</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return <p className="m-auto text-ivory/60">Picking your next question…</p>;
  }

  const hintControl =
    allowHint && !hint ? (
      <button
        type="button"
        className="absolute bottom-full right-1 mb-2 min-h-12 touch-manipulation rounded-full border border-[#4C8BF5]/50 bg-navy px-3 py-1.5 text-sm text-[#4C8BF5]"
        onClick={() => void requestHint()}
      >
        Hint
      </button>
    ) : null;

  return (
    <>
      <div className="hidden min-h-0 flex-1 flex-col md:flex" data-player-stage="desktop">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-ivory/45">
            <span>
              Question {question.question_index + 1} of {question.total_questions}
            </span>
            <span className="text-[#4C8BF5]">
              {question.standard_code ? `${question.standard_code} — ${question.standard_title}` : "Adaptive"}
            </span>
          </div>
          <h1 className="mt-3 max-h-[22vh] overflow-y-auto font-display text-xl leading-snug">{question.stem}</h1>
          {hint ? <p className="mt-3 border border-[#4C8BF5]/40 bg-[#4C8BF5]/10 px-3 py-2 text-sm">{hint}</p> : null}
          {hintError ? <p className="mt-2 text-sm text-red-300">{hintError}</p> : null}
          <div className="mt-4 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto">
            {question.choices.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={busy}
                onClick={() => void pick(item.key)}
                className={cn(
                  "min-h-14 rounded-md border px-3 py-3 text-left text-base font-medium",
                  "border-ivory/20 bg-card active:bg-gold active:text-navy",
                  choice === item.key && flash === "correct" && "border-emerald-400 bg-emerald-900/50",
                  choice === item.key && flash === "wrong" && "border-red-400 bg-red-900/50",
                )}
              >
                <span className="mr-3 text-gold">{item.key}</span>
                {item.text}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border border-white/10 bg-card px-3 py-3">
            <p className="text-sm text-ivory/70">
              {flash === "correct" ? `+${delta ?? 0}` : flash === "wrong" ? "+0" : "Tap an answer"}
            </p>
            {allowHint && !hint ? (
              <button type="button" className="text-sm text-[#4C8BF5]" onClick={() => void requestHint()}>
                Hint
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <MobilePlayerStage
          debug={debug}
          headerLeft={
            <span>
              Drill: Q {question.question_index + 1} / {question.total_questions}
            </span>
          }
          headerCenter={<span className="max-w-[9rem] truncate text-[11px] text-[#4C8BF5]">{question.standard_code ?? "Adaptive"}</span>}
          headerRight={<span>{delta != null ? (delta > 0 ? `+${delta}` : "0") : ""}</span>}
          questionKey={question.question_id}
          question={
            <>
              <p>{question.stem}</p>
              {hint ? <p className="mt-3 border border-[#4C8BF5]/40 bg-[#4C8BF5]/10 px-3 py-2 text-sm">{hint}</p> : null}
              {hintError ? <p className="mt-2 text-sm text-red-300">{hintError}</p> : null}
            </>
          }
          revealPanel={
            flash ? (
              <MobileRevealPanel
                lastDelta={flash === "correct" ? Math.max(delta ?? 1, 1) : 0}
                correctKey={flash === "correct" ? choice : null}
                explanation=""
              />
            ) : null
          }
          answers={
            <MobileAnswerButtons
              choices={question.choices}
              phase={flash ? "reveal" : "question"}
              choice={choice}
              correctKey={flash === "correct" ? choice : flash === "wrong" ? "__none__" : null}
              onLock={(key) => void pick(key)}
              disabled={busy}
            />
          }
          floating={hintControl}
        />
      </div>
    </>
  );
}
