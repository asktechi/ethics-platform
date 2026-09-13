"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadHostLiveAction,
  quizEndAction,
  quizPauseAction,
  quizRevealAction,
  quizSetConnectedAction,
  quizSetQuestionAction,
  quizSkipAction,
} from "@/app/(app)/_actions/quiz.actions";
import { AudienceQr } from "@/components/presentation/AudienceQr";
import { BestAnswerPanel, type BestAnswer } from "@/components/quiz/BestAnswerPanel";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { ResponseDistribution } from "@/components/quiz/ResponseDistribution";
import { Button } from "@/components/ui/button";
import { dispatch, resetQuizBus, subscribe } from "@/lib/quiz/bus";
import { writeHostToken } from "@/lib/quiz/host-token";
import { hostConnect } from "@/lib/quiz/realtime";
import { scoreQuestion } from "@/lib/quiz/scoring";
import type { QuizEvent, QuizHostQuestion, QuizSettings } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ResponseRow = {
  participant_id: string;
  question_id: string;
  choice_key: string | null;
  ms_taken: number | null;
  is_correct: boolean | null;
};

type Props = {
  sessionId: string;
  hostId: string;
  hostToken: string;
  joinCode: string;
  joinUrl: string;
  questions: QuizHostQuestion[];
  timePerQ: number;
  initialIndex: number;
  initialReveal: boolean;
  initialEnded: boolean;
  initialPaused: boolean;
  initialRemainingMs: number | null;
  initialQuestionStartedAt: string | null;
  initialParticipants: LivePlayer[];
  initialResponses: ResponseRow[];
  poolName: string;
};

export function HostDashboard({
  sessionId,
  hostId,
  hostToken,
  joinCode,
  joinUrl,
  questions,
  timePerQ,
  initialIndex,
  initialReveal,
  initialEnded,
  initialPaused,
  initialRemainingMs,
  initialQuestionStartedAt,
  initialParticipants,
  initialResponses,
  poolName,
}: Props) {
  const router = useRouter();
  const startedFromSettings = initialQuestionStartedAt ? Date.parse(initialQuestionStartedAt) : NaN;
  const [index, setIndex] = useState(initialIndex);
  const [phase, setPhase] = useState<"ready" | "countdown" | "question" | "reveal" | "ended">(
    initialEnded
      ? "ended"
      : initialReveal
        ? "reveal"
        : Number.isFinite(startedFromSettings) || initialIndex > 0
          ? "question"
          : "ready",
  );
  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(initialPaused);
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs ?? timePerQ * 1000);
  const [startedAt, setStartedAt] = useState<number | null>(
    initialPaused || !Number.isFinite(startedFromSettings) ? null : startedFromSettings,
  );
  const [now, setNow] = useState(Date.now());
  const [players, setPlayers] = useState<LivePlayer[]>(initialParticipants);
  const [responses, setResponses] = useState<ResponseRow[]>(initialResponses);
  const [joins, setJoins] = useState<string[]>([]);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const [boardOpen, setBoardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastEventRef = useRef<QuizEvent | null>(null);
  const revealingRef = useRef(false);
  const lastSeenRef = useRef(new Map<string, number>());
  const phaseRef = useRef(phase);
  const indexRef = useRef(index);
  phaseRef.current = phase;
  indexRef.current = index;

  const question = questions[index];
  const questionResponses = responses.filter((row) => row.question_id === question?.question_id);
  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const row of questionResponses) {
      const key = row.choice_key ?? "";
      if (!key) continue;
      next[key] = (next[key] ?? 0) + 1;
    }
    return next;
  }, [questionResponses]);

  const best = useMemo<BestAnswer | null>(() => {
    if (phase !== "reveal" || !question) return null;
    const correct = questionResponses
      .filter((row) => (row.choice_key ?? "").toUpperCase() === question.answer_key.toUpperCase())
      .sort((a, b) => (a.ms_taken ?? 9e9) - (b.ms_taken ?? 9e9))[0];
    if (!correct) return null;
    const player = players.find((item) => item.id === correct.participant_id);
    const priorStreak = Math.max(0, (player?.streak ?? 1) - 1);
    const scored = scoreQuestion(correct.ms_taken ?? timePerQ * 1000, timePerQ, priorStreak, true);
    return {
      display_name: player?.display_name ?? "Player",
      avatar_color: player?.avatar_color ?? null,
      ms_taken: correct.ms_taken ?? 0,
      points: scored.points,
    };
  }, [phase, players, question, questionResponses, timePerQ]);

  const remaining = paused
    ? Math.ceil(remainingMs / 1000)
    : startedAt
      ? Math.max(0, timePerQ - Math.floor((now - startedAt) / 1000))
      : Math.ceil(remainingMs / 1000);

  const currentQuestionEvent = useCallback((): QuizEvent | null => {
    const current = questions[indexRef.current];
    if (!current) return null;
    if (phaseRef.current === "reveal") {
      return {
        type: "REVEAL",
        question_id: current.question_id,
        correct_key: current.answer_key,
        explanation: current.explanation ?? "",
      };
    }
    if (phaseRef.current === "ended") return { type: "END" };
    if (phaseRef.current === "question") {
      return {
        type: "QUESTION",
        questionIndex: indexRef.current,
        question_id: current.question_id,
        stem: current.stem,
        choices: current.choices,
        time_limit_seconds: timePerQ,
        started_at: new Date(startedAt ?? Date.now()).toISOString(),
      };
    }
    return lastEventRef.current;
  }, [questions, startedAt, timePerQ]);

  useEffect(() => {
    writeHostToken(sessionId, hostToken);
    initialParticipants.forEach((player) => {
      if (player.connected !== false) lastSeenRef.current.set(player.id, Date.now());
    });
    resetQuizBus({
      sessionId,
      questionCount: questions.length,
      questionIndex: index,
      revealOpen: phase === "reveal",
      ended: phase === "ended",
      isPaused: paused,
      currentQuestionId: question?.question_id ?? null,
    });
    const client = createClient();
    const connection = hostConnect(client, sessionId, {
      hostId,
      hostToken,
      snapshot: () => lastEventRef.current ?? currentQuestionEvent(),
    });
    const unsub = subscribe((event) => {
      if (event.type === "QUESTION") setIndex(event.questionIndex);
    });

    const participantsChannel = client
      .channel(`db-participants:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as LivePlayer & { id?: string; display_name?: string };
          if (!row?.id) return;
          if (payload.eventType === "INSERT") {
            lastSeenRef.current.set(row.id, Date.now());
            setJoins((current) => [`${row.display_name} joined`, ...current].slice(0, 8));
          }
          setPlayers((current) => {
            const next = current.filter((item) => item.id !== row.id);
            if (payload.eventType !== "DELETE") next.push(row as LivePlayer);
            return next;
          });
        },
      )
      .subscribe();

    const responsesChannel = client
      .channel(`db-responses:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_responses", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as ResponseRow;
          if (!row?.question_id) return;
          setResponses((current) => {
            const next = current.filter(
              (item) => !(item.participant_id === row.participant_id && item.question_id === row.question_id),
            );
            next.push(row);
            return next;
          });
        },
      )
      .subscribe();

    let pulse = 0;
    void connection.ready.then((channel) => {
      const snapshot = currentQuestionEvent();
      if (snapshot && (phaseRef.current === "question" || phaseRef.current === "reveal")) {
        lastEventRef.current = snapshot;
        void connection.publish(snapshot);
      }
      pulse = window.setInterval(() => {
        const state = channel.presenceState() as Record<string, Array<{ participant_id?: string }>>;
        const present = Object.values(state)
          .flat()
          .map((item) => item.participant_id)
          .filter((id): id is string => Boolean(id));
        const seenAt = Date.now();
        present.forEach((id) => lastSeenRef.current.set(id, seenAt));
        const online = [...lastSeenRef.current.entries()]
          .filter(([, at]) => seenAt - at < 15_000)
          .map(([id]) => id);
        setPlayers((current) => current.map((player) => ({ ...player, connected: online.includes(player.id) })));
        void quizSetConnectedAction(sessionId, online);
      }, 4000);
    });

    return () => {
      unsub();
      if (pulse) window.clearInterval(pulse);
      connection.disconnect();
      void client.removeChannel(participantsChannel);
      void client.removeChannel(responsesChannel);
    };
    // Connect once per session. Snapshot returns the last published event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const publishQuestion = useCallback(
    async (nextIndex: number) => {
      const next = questions[nextIndex];
      if (!next) return;
      revealingRef.current = false;
      const result = await quizSetQuestionAction(sessionId, nextIndex);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const started = new Date().toISOString();
      const event: QuizEvent = {
        type: "QUESTION",
        questionIndex: nextIndex,
        question_id: next.question_id,
        stem: next.stem,
        choices: next.choices,
        time_limit_seconds: timePerQ,
        started_at: started,
      };
      lastEventRef.current = event;
      dispatch(event);
      setIndex(nextIndex);
      setStartedAt(Date.now());
      setRemainingMs(timePerQ * 1000);
      setPaused(false);
      setPhase("question");
      setChangedIds(new Set());
    },
    [questions, sessionId, timePerQ],
  );

  const publishReveal = useCallback(async () => {
    if (!question || revealingRef.current || phaseRef.current === "reveal") return;
    revealingRef.current = true;
    const before = new Map(players.map((player) => [player.id, player.score]));
    const result = await quizRevealAction(sessionId, question.question_id, question.answer_key);
    if (!result.ok) {
      revealingRef.current = false;
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
    setPhase("reveal");
    const live = await loadHostLiveAction(sessionId);
    if (live.ok) {
      setPlayers(live.participants);
      const changed = new Set<string>();
      live.participants.forEach((player) => {
        if ((before.get(player.id) ?? 0) !== player.score) changed.add(player.id);
      });
      setChangedIds(changed);
      window.setTimeout(() => setChangedIds(new Set()), 2800);
    }
  }, [players, question, sessionId]);

  const publishEnd = useCallback(
    async (early = false) => {
      const result = await quizEndAction(sessionId);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const event: QuizEvent = { type: "END", early };
      lastEventRef.current = event;
      dispatch(event);
      setPhase("ended");
      router.push(`/quiz/host/${sessionId}/summary`);
    },
    [router, sessionId],
  );

  const goNext = useCallback(() => {
    dispatch({ type: "NEXT" });
    if (index >= questions.length - 1) void publishEnd(false);
    else void publishQuestion(index + 1);
  }, [index, publishEnd, publishQuestion, questions.length]);

  const goPrev = useCallback(() => {
    if (index === 0) return;
    dispatch({ type: "PREV" });
    void publishQuestion(index - 1);
  }, [index, publishQuestion]);

  async function togglePause() {
    if (phase !== "question") return;
    const left = remaining * 1000;
    const result = await quizPauseAction(sessionId, !paused, left);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    if (paused) {
      const event: QuizEvent = { type: "RESUME", started_at: new Date().toISOString(), remaining_ms: left };
      lastEventRef.current = event;
      dispatch(event);
      setStartedAt(Date.now() - (timePerQ * 1000 - left));
      setPaused(false);
    } else {
      const event: QuizEvent = { type: "PAUSE", remaining_ms: left };
      lastEventRef.current = event;
      dispatch(event);
      setRemainingMs(left);
      setPaused(true);
    }
  }

  async function skip() {
    if (!question) return;
    const result = await quizSkipAction(sessionId);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const event: QuizEvent = { type: "SKIP", question_id: question.question_id };
    lastEventRef.current = event;
    dispatch(event);
    if (index >= questions.length - 1) {
      await publishEnd(true);
      return;
    }
    await publishQuestion(index + 1);
  }

  useEffect(() => {
    if (phase !== "question" || paused) return;
    const timeUp =
      remaining === 0 && startedAt != null && Date.now() >= startedAt + timePerQ * 1000 - 50;
    const allIn = players.length > 0 && questionResponses.length >= players.length;
    if (timeUp || allIn) void publishReveal();
  }, [phase, paused, remaining, startedAt, timePerQ, questionResponses.length, players.length, publishReveal]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      void publishQuestion(0);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, publishQuestion]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.code === "Space" || event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        if (phase === "ready") setPhase("countdown");
        else if (phase === "reveal") goNext();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
      }
      if (event.key.toLowerCase() === "r") void publishReveal();
      if (event.key.toLowerCase() === "p") void togglePause();
      if (event.key.toLowerCase() === "e") setConfirmEnd(true);
      if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
      if (event.key.toLowerCase() === "g") setBoardOpen((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = joinUrl.startsWith("http") ? joinUrl : `${origin}${joinUrl}`;

  if (phase === "ready" || phase === "countdown") {
    return (
      <div className="min-h-screen bg-navy px-6 py-8 text-ivory">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">{poolName}</p>
            <h1 className="mt-2 font-display text-4xl">Ready room</h1>
            <p className="mt-4 font-mono text-6xl tracking-[0.28em] text-gold">{joinCode}</p>
            <p className="mt-3 text-ivory/60">{players.length} joined</p>
            {phase === "countdown" ? (
              <p className="mt-10 font-display text-8xl text-gold">{countdown || "Go"}</p>
            ) : (
              <Button className="mt-8 bg-gold text-navy hover:bg-gold/90" onClick={() => setPhase("countdown")}>
                Start 3-2-1
              </Button>
            )}
          </div>
          <AudienceQr url={url} label="Player QR" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy text-ivory">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-4 py-3">
        <p className="font-mono text-3xl tracking-[0.2em] text-gold">{joinCode}</p>
        <p className="text-sm text-ivory/70">{players.length} players</p>
        <p className="text-sm text-ivory/70">
          Question {index + 1} of {questions.length} · {remaining}s remaining
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void togglePause()}>
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void skip()}>
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmEnd(true)}>
            End session
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
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
              style={{ width: `${Math.max(0, Math.min(100, (remaining / timePerQ) * 100))}%` }}
            />
          </div>
          {paused ? <p className="mt-3 text-center text-gold">Paused</p> : null}
        </section>

        <aside className="space-y-4 border border-white/10 bg-card p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Live</p>
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
            revealed={phase === "reveal"}
            correctKey={question?.answer_key ?? null}
          />
          {phase === "reveal" ? (
            <BestAnswerPanel
              best={best}
              onShow={() => {
                if (!best) return;
                const event: QuizEvent = {
                  type: "HIGHLIGHT",
                  display_name: best.display_name,
                  avatar_color: best.avatar_color,
                  ms_taken: best.ms_taken,
                  points: best.points,
                };
                lastEventRef.current = event;
                dispatch(event);
              }}
            />
          ) : null}
        </aside>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
        <Button variant="outline" disabled={index === 0} onClick={() => goPrev()}>
          Previous
        </Button>
        <Button variant="outline" onClick={() => void publishReveal()}>
          Reveal answer
        </Button>
        <Button className="bg-gold text-navy hover:bg-gold/90" onClick={() => goNext()}>
          Next question
        </Button>
        <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
          End session
        </Button>
        {message ? <p className="ml-auto text-sm text-ivory/60">{message}</p> : null}
      </footer>

      {boardOpen ? (
        <div className="fixed inset-0 z-40 overflow-auto bg-navy/95 p-8">
          <div className="mx-auto max-w-xl">
            <h2 className="font-display text-3xl">Leaderboard</h2>
            <div className="mt-6">
              <Leaderboard players={players} changedIds={changedIds} />
            </div>
            <Button className="mt-6" variant="outline" onClick={() => setBoardOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {confirmEnd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4">
          <div className="w-full max-w-sm space-y-3 border border-border bg-card p-4">
            <p className="text-ivory">End this session now?</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                Cancel
              </Button>
              <Button
                className="bg-gold text-navy hover:bg-gold/90"
                onClick={() => void publishEnd(!(index === questions.length - 1 && phase === "reveal"))}
              >
                End session
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { QuizSettings };
