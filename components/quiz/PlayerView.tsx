"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalLeaderboardAction, myParticipantAction, submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import { playerConnect } from "@/lib/quiz/realtime";
import { readPlayerIdentity } from "@/lib/quiz/storage";
import type { LeaderboardRow, QuizEvent, QuizPlayQuestion } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Phase = "waiting" | "question" | "locked" | "reveal" | "ended";

export function PlayerView({
  sessionId,
  joinCode,
  questionCount,
}: {
  sessionId: string;
  joinCode: string;
  questionCount: number;
}) {
  const router = useRouter();
  const identity = useMemo(() => readPlayerIdentity(sessionId), [sessionId]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [question, setQuestion] = useState<QuizPlayQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeLimit, setTimeLimit] = useState(30);
  const [now, setNow] = useState(Date.now());
  const [choice, setChoice] = useState<string | null>(null);
  const [correctKey, setCorrectKey] = useState<string | null>(null);
  const [explanation, setExplanation] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastDelta, setLastDelta] = useState<number | "missed" | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitted = useRef(false);
  const choiceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!identity) router.replace(`/quiz/join/${joinCode}`);
  }, [identity, joinCode, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!identity) return;
    const client = createClient();
    const connection = playerConnect(client, sessionId, (event) => {
      handleEvent(event);
    });
    return () => connection.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, sessionId]);

  const remaining = startedAt
    ? Math.max(0, timeLimit - Math.floor((now - startedAt) / 1000))
    : timeLimit;

  useEffect(() => {
    if (phase !== "question" || !question || remaining > 0 || submitted.current) return;
    void lockIn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining, question]);

  async function lockIn(key: string | null) {
    if (!identity || !question || submitted.current) return;
    submitted.current = true;
    choiceRef.current = key;
    setChoice(key);
    setSubmitError(null);
    setPhase("locked");
    const msTaken = startedAt ? Date.now() - startedAt : timeLimit * 1000;
    const result = await submitAnswerAction({
      token: identity.participant_token,
      questionId: question.question_id,
      choiceKey: key,
      msTaken,
    });
    if (!result.ok) {
      submitted.current = false;
      setPhase("question");
      setSubmitError(result.error);
    }
  }

  function handleEvent(event: QuizEvent) {
    if (event.type === "QUESTION") {
      submitted.current = false;
      setQuestion({
        question_id: event.question_id,
        stem: event.stem,
        choices: event.choices,
        time_limit_seconds: event.time_limit_seconds,
      });
      setQuestionIndex(event.questionIndex);
      setTimeLimit(event.time_limit_seconds);
      setStartedAt(new Date(event.started_at).getTime());
      setChoice(null);
      setCorrectKey(null);
      setExplanation("");
      setLastDelta(null);
      setPhase("question");
      return;
    }
    if (event.type === "REVEAL") {
      const picked = choiceRef.current ?? choice;
      const correct = event.correct_key.toUpperCase();
      setCorrectKey(correct);
      setExplanation(event.explanation);
      if (!picked) {
        setLastDelta("missed");
        setStreak(0);
      } else if (picked.toUpperCase() === correct) {
        setLastDelta(100);
        setScore((value) => value + 100);
        setStreak((value) => value + 1);
      } else {
        setLastDelta(0);
        setStreak(0);
      }
      setPhase("reveal");
      if (identity) {
        void myParticipantAction(identity.participant_token).then((result) => {
          if (result.ok) {
            setScore(result.participant.score ?? 0);
            setStreak(result.participant.streak ?? 0);
          }
        });
      }
      return;
    }
    if (event.type === "END") {
      setPhase("ended");
      void finalLeaderboardAction(sessionId).then((result) => {
        if (result.ok) setBoard(result.rows as LeaderboardRow[]);
      });
    }
  }

  if (!identity) {
    return <p className="p-6 text-ivory/60">Redirecting to join…</p>;
  }

  if (phase === "waiting") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-navy px-6 text-center text-ivory">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Live quiz</p>
        <h1 className="mt-3 font-display text-3xl">Waiting for first question</h1>
        <p className="mt-3 text-ivory/60">Stay on this screen, {identity.display_name}.</p>
        <span className="mt-6 h-4 w-4 rounded-full" style={{ background: identity.avatar_color }} />
      </div>
    );
  }

  if (phase === "ended") {
    const mine = board.find((row) => row.participant_id === identity.participant_id);
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-navy px-6 text-center text-ivory">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Thanks for playing</p>
        <h1 className="mt-3 font-display text-4xl">{score} pts</h1>
        <p className="mt-2 text-ivory/70">
          {mine ? `Rank ${mine.rank}` : "Final score"} · streak {streak}
        </p>
        <ol className="mt-6 w-full max-w-sm space-y-2 text-left">
          {board.slice(0, 8).map((row) => (
            <li
              key={row.participant_id}
              className="flex items-center justify-between border border-white/10 px-3 py-2"
            >
              <span>
                {row.rank}. {row.display_name}
              </span>
              <span className="tabular-nums text-gold">{row.score}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-navy px-4 py-5 text-ivory">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-ivory/45">
        <span>
          Question {questionIndex + 1} of {questionCount || "—"}
        </span>
        <span className="tabular-nums text-gold">{remaining}s</span>
      </div>
      <h1 className="mt-4 font-display text-2xl leading-snug">{question?.stem}</h1>
      <div className="mt-6 grid flex-1 content-start gap-3">
        {(question?.choices ?? []).map((item) => {
          const selected = choice === item.key;
          const isCorrect = correctKey === item.key;
          const isWrong = phase === "reveal" && selected && !isCorrect;
          return (
            <button
              key={item.key}
              type="button"
              disabled={phase !== "question"}
              onClick={() => void lockIn(item.key)}
              className={cn(
                "min-h-16 rounded-md border px-4 py-4 text-left text-lg font-medium",
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
      {phase === "locked" ? (
        <p className="mt-4 text-center text-sm text-ivory/60">Waiting for others…</p>
      ) : null}
      {submitError ? <p className="mt-3 text-center text-sm text-red-300">{submitError}</p> : null}
      {phase === "reveal" ? (
        <div className="mt-4 border border-white/10 bg-card p-4">
          <p className="font-display text-2xl text-gold">
            {lastDelta === "missed" ? "Missed" : lastDelta === 100 ? "+100" : "+0"}
          </p>
          <p className="text-sm text-ivory/70">
            Score {score} · streak {streak}
          </p>
          {explanation ? <p className="mt-2 text-sm text-ivory/80">{explanation}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
