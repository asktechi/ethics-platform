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
import { HostQuestionView } from "@/app/quiz/host/[sessionId]/HostQuestionView";
import { HostSidePanel } from "@/app/quiz/host/[sessionId]/HostSidePanel";
import { JeopardyHost } from "@/app/quiz/host/[sessionId]/modes/JeopardyHost";
import { RapidFireHost } from "@/app/quiz/host/[sessionId]/modes/RapidFireHost";
import { TeamBattleHost } from "@/app/quiz/host/[sessionId]/modes/TeamBattleHost";
import { AudienceQr } from "@/components/presentation/AudienceQr";
import type { BestAnswer } from "@/components/quiz/BestAnswerPanel";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { Button } from "@/components/ui/button";
import { getMode } from "@/lib/games/modes/registry";
import type { GameTeamRecord, HostExtraPanelProps } from "@/lib/games/modes/types";
import { dispatch, resetQuizBus, subscribe } from "@/lib/quiz/bus";
import { writeHostToken } from "@/lib/quiz/host-token";
import { hostConnect } from "@/lib/quiz/realtime";
import type { QuizEvent, QuizHostQuestion, QuizSettings } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";

type ResponseRow = {
  participant_id: string;
  question_id: string;
  choice_key: string | null;
  ms_taken: number | null;
  is_correct: boolean | null;
};

export type HostShellProps = {
  sessionId: string;
  hostId: string;
  hostToken: string;
  joinCode: string;
  joinUrl: string;
  questions: QuizHostQuestion[];
  timePerQ: number;
  modeId: string;
  modeConfig: Record<string, unknown>;
  initialIndex: number;
  initialReveal: boolean;
  initialEnded: boolean;
  initialPaused: boolean;
  initialRemainingMs: number | null;
  initialQuestionStartedAt: string | null;
  initialParticipants: LivePlayer[];
  initialResponses: ResponseRow[];
  initialTeams: GameTeamRecord[];
  poolName: string;
  gameStartedAt: string | null;
};

const HOST_PANELS = {
  jeopardy: JeopardyHost,
  rapid_fire: RapidFireHost,
  team_battle: TeamBattleHost,
} as const;

export function HostShell({
  sessionId,
  hostId,
  hostToken,
  joinCode,
  joinUrl,
  questions,
  timePerQ,
  modeId,
  modeConfig,
  initialIndex,
  initialReveal,
  initialEnded,
  initialPaused,
  initialRemainingMs,
  initialQuestionStartedAt,
  initialParticipants,
  initialResponses,
  initialTeams,
  poolName,
  gameStartedAt,
}: HostShellProps) {
  const router = useRouter();
  const mode = getMode(modeId);
  const isRapid = mode.id === "rapid_fire";
  const isTeam = mode.id === "team_battle";
  const totalTime = Number(modeConfig.total_time_seconds ?? (isRapid ? timePerQ : timePerQ));
  const startedFromSettings = initialQuestionStartedAt ? Date.parse(initialQuestionStartedAt) : NaN;
  const gameStartMs = gameStartedAt ? Date.parse(gameStartedAt) : startedFromSettings;
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
  const [clockStart, setClockStart] = useState<number | null>(Number.isFinite(gameStartMs) ? gameStartMs : null);
  const [now, setNow] = useState(Date.now());
  const [players, setPlayers] = useState<LivePlayer[]>(initialParticipants);
  const [responses, setResponses] = useState<ResponseRow[]>(initialResponses);
  const [teams, setTeams] = useState<GameTeamRecord[]>(initialTeams);
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
  const endedRef = useRef(false);
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

  const remaining = isRapid
    ? clockStart
      ? Math.max(0, totalTime - Math.floor((now - clockStart) / 1000))
      : totalTime
    : paused
      ? Math.ceil(remainingMs / 1000)
      : startedAt
        ? Math.max(0, timePerQ - Math.floor((now - startedAt) / 1000))
        : Math.ceil(remainingMs / 1000);

  const best = useMemo<BestAnswer | null>(() => {
    if (phase !== "reveal" || !question) return null;
    const correct = questionResponses
      .filter((row) => (row.choice_key ?? "").toUpperCase() === question.answer_key.toUpperCase())
      .sort((a, b) => (a.ms_taken ?? 9e9) - (b.ms_taken ?? 9e9))[0];
    if (!correct) return null;
    const player = players.find((item) => item.id === correct.participant_id);
    const priorStreak = Math.max(0, (player?.streak ?? 1) - 1);
    const scored = mode.scoreResponse({
      isCorrect: true,
      msTaken: correct.ms_taken ?? timePerQ * 1000,
      timeLimitMs: timePerQ * 1000,
      basePoints: Number(modeConfig.base_points ?? 100),
      priorCorrect: priorStreak,
      timeBonusEnabled: modeConfig.time_bonus !== false,
      streakBonusEnabled: modeConfig.streak_bonus !== false,
    });
    return {
      display_name: player?.display_name ?? "Player",
      avatar_color: player?.avatar_color ?? null,
      ms_taken: correct.ms_taken ?? 0,
      points: scored.points,
    };
  }, [mode, modeConfig, phase, players, question, questionResponses, timePerQ]);

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
        time_limit_seconds: isRapid ? totalTime : timePerQ,
        started_at: new Date(clockStart ?? startedAt ?? Date.now()).toISOString(),
      };
    }
    return lastEventRef.current;
  }, [clockStart, isRapid, questions, startedAt, timePerQ, totalTime]);

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
          if (isRapid && row.is_correct) {
            setChangedIds((current) => new Set(current).add(row.participant_id));
            window.setTimeout(() => setChangedIds(new Set()), 1600);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const ctx = useMemo(
    () => ({ sessionId, modeId: mode.id, questionCount: questions.length, settings: modeConfig }),
    [mode.id, modeConfig, questions.length, sessionId],
  );

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
      const startMs = isRapid ? (clockStart ?? Date.now()) : Date.now();
      if (isRapid && clockStart == null) setClockStart(startMs);
      const started = new Date(startMs).toISOString();
      const event: QuizEvent = {
        type: "QUESTION",
        questionIndex: nextIndex,
        question_id: next.question_id,
        stem: next.stem,
        choices: next.choices,
        time_limit_seconds: isRapid ? totalTime : timePerQ,
        started_at: started,
      };
      lastEventRef.current = event;
      dispatch(event);
      setIndex(nextIndex);
      if (!isRapid) {
        setStartedAt(Date.now());
        setRemainingMs(timePerQ * 1000);
      }
      setPaused(false);
      setPhase("question");
      setChangedIds(new Set());
      await mode.onQuestionStart?.(ctx, nextIndex);
    },
    [clockStart, ctx, isRapid, mode, questions, sessionId, timePerQ, totalTime],
  );

  const publishReveal = useCallback(async () => {
    if (isRapid || !question || revealingRef.current || phaseRef.current === "reveal") return;
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
    await mode.onAnswerReveal?.(ctx, index);
    const live = await loadHostLiveAction(sessionId);
    if (live.ok) {
      setPlayers(live.participants);
      if ("teams" in live && live.teams) setTeams(live.teams as GameTeamRecord[]);
      const changed = new Set<string>();
      live.participants.forEach((player) => {
        if ((before.get(player.id) ?? 0) !== player.score) changed.add(player.id);
      });
      setChangedIds(changed);
      window.setTimeout(() => setChangedIds(new Set()), 2800);
    }
  }, [ctx, index, isRapid, mode, players, question, sessionId]);

  const publishEnd = useCallback(
    async (early = false) => {
      if (endedRef.current) return;
      endedRef.current = true;
      const result = await quizEndAction(sessionId);
      if (!result.ok) {
        endedRef.current = false;
        setMessage(result.error);
        return;
      }
      await mode.onSessionEnd?.(ctx);
      const event: QuizEvent = { type: "END", early };
      lastEventRef.current = event;
      dispatch(event);
      setPhase("ended");
      router.push(`/quiz/host/${sessionId}/summary`);
    },
    [ctx, mode, router, sessionId],
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
    if (isRapid || phase !== "question") return;
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
    const event: QuizEvent = { type: "SKIP", question_id: question.question_id, questionIndex: index };
    lastEventRef.current = event;
    dispatch(event);
    if (index >= questions.length - 1) {
      await publishEnd(true);
      return;
    }
    await publishQuestion(index + 1);
  }

  useEffect(() => {
    if (isRapid) return;
    if (phase !== "question" || paused) return;
    const timeUp =
      remaining === 0 && startedAt != null && Date.now() >= startedAt + timePerQ * 1000 - 50;
    const allIn = players.length > 0 && questionResponses.length >= players.length;
    if (timeUp || allIn) void publishReveal();
  }, [isRapid, phase, paused, remaining, startedAt, timePerQ, questionResponses.length, players.length, publishReveal]);

  useEffect(() => {
    if (!isRapid || phase !== "question" || clockStart == null) return;
    if (remaining === 0) void publishEnd(true);
  }, [clockStart, isRapid, phase, publishEnd, remaining]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      void mode.onSessionStart?.(ctx);
      void publishQuestion(0);
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, publishQuestion, mode, ctx]);

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
      if (!isRapid && event.key.toLowerCase() === "r") void publishReveal();
      if (!isRapid && event.key.toLowerCase() === "p") void togglePause();
      if (event.key.toLowerCase() === "e") setConfirmEnd(true);
      if (event.key.toLowerCase() === "f") void document.documentElement.requestFullscreen?.();
      if (event.key.toLowerCase() === "g") setBoardOpen((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = joinUrl.startsWith("http") ? joinUrl : `${origin}${joinUrl}`;
  const Extra = (mode.HostExtraPanel ?? HOST_PANELS[mode.id as keyof typeof HOST_PANELS] ?? JeopardyHost);
  const extraProps: HostExtraPanelProps = {
    sessionId,
    questions,
    index,
    phase,
    remaining,
    players,
    responses,
    teams,
    modeConfig,
    onSkip: () => void skip(),
  };

  if (phase === "ready" || phase === "countdown") {
    return (
      <div className="min-h-screen bg-navy px-6 py-8 text-ivory">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">
              {poolName} · {mode.name}
            </p>
            <h1 className="mt-2 font-display text-4xl">Ready room</h1>
            <p className="mt-4 font-mono text-6xl tracking-[0.28em] text-gold">{joinCode}</p>
            <p className="mt-3 text-ivory/60">{players.length} joined</p>
            {isTeam ? <div className="mt-6"><TeamBattleHost {...extraProps} /></div> : null}
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
        {isRapid ? (
          <p className="font-mono text-2xl tabular-nums text-gold">{remaining}s</p>
        ) : (
          <p className="text-sm text-ivory/70">
            Question {index + 1} of {questions.length} · {remaining}s remaining
          </p>
        )}
        {isTeam ? <TeamBattleHost {...extraProps} phase="header" /> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {isRapid ? null : (
            <Button size="sm" variant="outline" onClick={() => void togglePause()}>
              {paused ? "Resume" : "Pause"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void skip()}>
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmEnd(true)}>
            End session
          </Button>
        </div>
      </header>

      <div className={`grid flex-1 gap-4 p-4 ${isRapid ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        {isRapid ? (
          <RapidFireHost {...extraProps} />
        ) : (
          <>
            <HostQuestionView
              question={question}
              phase={phase}
              counts={counts}
              remaining={remaining}
              timePerQ={timePerQ}
              paused={paused}
            />
            <HostSidePanel
              players={players}
              changedIds={changedIds}
              joins={joins}
              question={question}
              counts={counts}
              revealed={phase === "reveal"}
              best={best}
              extra={isTeam ? <TeamBattleHost {...extraProps} /> : <Extra {...extraProps} />}
              onHighlight={() => {
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
          </>
        )}
      </div>

      {isRapid ? null : (
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
      )}

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
