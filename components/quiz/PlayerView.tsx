"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalLeaderboardAction, myParticipantAction, submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import { playerConnect } from "@/lib/quiz/realtime";
import { readPlayerIdentity, writePlayerIdentity } from "@/lib/quiz/storage";
import type { LeaderboardRow, QuizEvent, QuizPlayQuestion } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Phase = "waiting" | "question" | "locked" | "reveal" | "ended";

export function PlayerView({
  sessionId,
  joinCode,
  questionCount,
  hostId,
  initialStatus,
}: {
  sessionId: string;
  joinCode: string;
  questionCount: number;
  hostId?: string | null;
  initialStatus?: string;
}) {
  const router = useRouter();
  const identity = useMemo(() => readPlayerIdentity(sessionId), [sessionId]);
  const [phase, setPhase] = useState<Phase>(initialStatus === "ended" ? "ended" : "waiting");
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
  const [paused, setPaused] = useState(false);
  const [frozenRemaining, setFrozenRemaining] = useState<number | null>(null);
  const [endedEarly, setEndedEarly] = useState(false);
  const [highlight, setHighlight] = useState<{
    display_name: string;
    avatar_color?: string | null;
    ms_taken: number;
    points: number;
  } | null>(null);
  const submitted = useRef(false);
  const choiceRef = useRef<string | null>(null);
  const questionIdRef = useRef<string | null>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!identity) router.replace(`/quiz/join/${joinCode}`);
  }, [identity, joinCode, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!identity) return;
    void myParticipantAction(identity.participant_token).then((result) => {
      if (!result.ok) return;
      setScore(result.participant.score ?? 0);
      setStreak(result.participant.streak ?? 0);
      scoreRef.current = result.participant.score ?? 0;
      writePlayerIdentity({
        ...identity,
        host_id: result.participant.host_id ?? identity.host_id ?? hostId ?? undefined,
        host_token: result.participant.host_token || identity.host_token,
      });
    });
  }, [hostId, identity]);

  useEffect(() => {
    if (!identity) return;
    const client = createClient();
    const connection = playerConnect(client, sessionId, (event) => {
      handleEvent(event);
    }, {
      hostId: identity.host_id ?? hostId,
      hostToken: identity.host_token,
      participantId: identity.participant_id,
    });
    return () => connection.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, sessionId, hostId]);

  const remaining = paused && frozenRemaining != null
    ? Math.max(0, Math.ceil(frozenRemaining / 1000))
    : startedAt
      ? Math.max(0, timeLimit - Math.floor((now - startedAt) / 1000))
      : timeLimit;

  useEffect(() => {
    if (phase !== "question" || paused || !question || remaining > 0 || submitted.current) return;
    void lockIn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining, question, paused]);

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
      if (submitted.current && questionIdRef.current === event.question_id) {
        return;
      }
      submitted.current = false;
      questionIdRef.current = event.question_id;
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
      setPaused(false);
      setFrozenRemaining(null);
      setHighlight(null);
      setPhase("question");
      return;
    }
    if (event.type === "REVEAL") {
      const picked = choiceRef.current ?? choice;
      const correct = event.correct_key.toUpperCase();
      setCorrectKey(correct);
      setExplanation(event.explanation);
      if (!picked) setLastDelta("missed");
      else setLastDelta(0);
      setPhase("reveal");
      if (identity) {
        void myParticipantAction(identity.participant_token).then((result) => {
          if (!result.ok) return;
          const nextScore = result.participant.score ?? 0;
          const earned = nextScore - scoreRef.current;
          setScore(nextScore);
          setStreak(result.participant.streak ?? 0);
          scoreRef.current = nextScore;
          if (!picked) setLastDelta("missed");
          else setLastDelta(Math.max(0, earned));
        });
      }
      return;
    }
    if (event.type === "PAUSE") {
      setPaused(true);
      setFrozenRemaining(event.remaining_ms ?? remaining * 1000);
      return;
    }
    if (event.type === "RESUME") {
      const left = event.remaining_ms ?? frozenRemaining ?? timeLimit * 1000;
      setPaused(false);
      setFrozenRemaining(null);
      setStartedAt(Date.now() - (timeLimit * 1000 - left));
      return;
    }
    if (event.type === "SKIP") {
      submitted.current = false;
      questionIdRef.current = null;
      setQuestion(null);
      setChoice(null);
      setCorrectKey(null);
      setPaused(false);
      setPhase("waiting");
      return;
    }
    if (event.type === "HIGHLIGHT") {
      setHighlight({
        display_name: event.display_name,
        avatar_color: event.avatar_color,
        ms_taken: event.ms_taken,
        points: event.points,
      });
      return;
    }
    if (event.type === "END") {
      setEndedEarly(Boolean(event.early));
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
        <p className="text-xs uppercase tracking-[0.18em] text-gold">
          {endedEarly ? "Session ended early" : "Thanks for playing"}
        </p>
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
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-navy px-4 py-4 text-ivory">
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
      <h1 className="mt-3 max-h-[22vh] shrink-0 overflow-y-auto font-display text-xl leading-snug">
        {question?.stem}
      </h1>
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
              onClick={() => void lockIn(item.key)}
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
        {phase === "question" ? (
          <p className="text-sm text-ivory/60">Tap an answer before the timer hits 0.</p>
        ) : null}
        {phase === "locked" ? <p className="text-sm text-ivory/80">Waiting for others…</p> : null}
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
  );
}
