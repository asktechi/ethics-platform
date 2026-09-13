"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { quizEndAction, quizRevealAction, quizSetQuestionAction } from "@/app/(app)/_actions/quiz.actions";
import { AudienceQr } from "@/components/presentation/AudienceQr";
import { Button } from "@/components/ui/button";
import { dispatch, resetQuizBus, subscribe } from "@/lib/quiz/bus";
import { hostConnect } from "@/lib/quiz/realtime";
import type { QuizEvent, QuizHostQuestion } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";

function testPanelEnabled() {
  return process.env.NEXT_PUBLIC_QUIZ_TEST_PANEL !== "false";
}

export function HostStub({
  sessionId,
  joinCode,
  joinUrl,
  questions,
  timePerQ,
}: {
  sessionId: string;
  joinCode: string;
  joinUrl: string;
  questions: QuizHostQuestion[];
  timePerQ: number;
}) {
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const current = questions[index];
  const showPanel = testPanelEnabled();
  const lastEventRef = useRef<QuizEvent | null>(null);

  useEffect(() => {
    resetQuizBus({ sessionId, questionCount: questions.length, questionIndex: 0 });
    const client = createClient();
    const connection = hostConnect(client, sessionId, () => lastEventRef.current);
    const unsub = subscribe((event) => {
      if (event.type === "QUESTION") setIndex(event.questionIndex);
    });
    return () => {
      unsub();
      connection.disconnect();
    };
    // Connect once per session. Snapshot returns the last published event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const url = joinUrl.startsWith("http") ? joinUrl : `${origin}${joinUrl}`;

  async function publishQuestion(nextIndex: number) {
    const question = questions[nextIndex];
    if (!question) return;
    const startedAt = new Date().toISOString();
    const result = await quizSetQuestionAction(sessionId, nextIndex);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const event: QuizEvent = {
      type: "QUESTION",
      questionIndex: nextIndex,
      question_id: question.question_id,
      stem: question.stem,
      choices: question.choices,
      time_limit_seconds: timePerQ,
      started_at: startedAt,
    };
    lastEventRef.current = event;
    dispatch(event);
    setIndex(nextIndex);
    setMessage(`Published question ${nextIndex + 1}`);
  }

  async function publishReveal() {
    const question = questions[index];
    if (!question) return;
    const result = await quizRevealAction(sessionId, question.question_id, question.answer_key);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const event: QuizEvent = {
      type: "REVEAL",
      question_id: question.question_id,
      correct_key: question.answer_key,
      explanation: question.explanation ?? "",
    };
    lastEventRef.current = event;
    dispatch(event);
    setMessage(`Revealed question ${index + 1}`);
  }

  async function publishEnd() {
    const result = await quizEndAction(sessionId);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    lastEventRef.current = { type: "END" };
    dispatch({ type: "END" });
    setMessage("Session ended");
  }

  return (
    <div className="min-h-screen bg-navy px-4 py-8 text-ivory">
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Live quiz host</p>
        <h1 className="font-display text-3xl">Session B — coming next</h1>
        <p className="text-ivory/65">
          The host dashboard, live response tape, best-answer surfacing, and scoring exports ship in Session B.
          Share the join code now so students can enter the waiting room.
        </p>
        <div className="grid gap-4 border border-border bg-card p-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Join code</p>
            <p className="mt-2 font-mono text-4xl tracking-[0.28em] text-gold">{joinCode}</p>
            <p className="mt-3 break-all text-sm text-ivory/70">{url}</p>
          </div>
          <AudienceQr url={url} label="Player QR" />
        </div>

        {showPanel ? (
          <section className="space-y-3 border border-dashed border-gold/40 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Session A test panel
            </p>
            <p className="text-sm text-ivory/60">
              Temporary publisher so the player flow can be verified before the real dashboard.
            </p>
            <p className="text-sm text-ivory/80">
              Current: {current ? `${index + 1}. ${current.stem.slice(0, 80)}` : "none"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="bg-gold text-navy hover:bg-gold/90" onClick={() => void publishQuestion(index)}>
                Publish QUESTION {index}
              </Button>
              <Button type="button" variant="outline" onClick={() => void publishReveal()}>
                Publish REVEAL {index}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={index >= questions.length - 1}
                onClick={() => void publishQuestion(index + 1)}
              >
                Publish QUESTION {index + 1}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void publishEnd()}>
                Publish END
              </Button>
            </div>
            {message ? <p className="text-sm text-ivory/70">{message}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
