"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JeopardyPlayer } from "@/app/quiz/play/[sessionId]/modes/JeopardyPlayer";
import { RapidFirePlayer } from "@/app/quiz/play/[sessionId]/modes/RapidFirePlayer";
import { TeamBattlePlayer } from "@/app/quiz/play/[sessionId]/modes/TeamBattlePlayer";
import { finalLeaderboardAction, myParticipantAction, submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import { getMode } from "@/lib/games/modes/registry";
import type { GameTeamRecord } from "@/lib/games/modes/types";
import { playerConnect } from "@/lib/quiz/realtime";
import { readPlayerIdentity, writePlayerIdentity } from "@/lib/quiz/storage";
import type { LeaderboardRow, QuizEvent, QuizPlayQuestion } from "@/lib/quiz/types";
import { createClient } from "@/lib/supabase/client";

type Phase = "waiting" | "question" | "locked" | "reveal" | "ended";

export function PlayerShell({
  sessionId,
  joinCode,
  questionCount,
  hostId,
  initialStatus,
  modeId,
  playQuestions,
  teams,
  modeConfig,
  gameStartedAt,
  timePerQ,
}: {
  sessionId: string;
  joinCode: string;
  questionCount: number;
  hostId?: string | null;
  initialStatus?: string;
  modeId: string;
  playQuestions: QuizPlayQuestion[];
  teams: GameTeamRecord[];
  modeConfig: Record<string, unknown>;
  gameStartedAt: string | null;
  timePerQ: number;
}) {
  const router = useRouter();
  const mode = getMode(modeId);
  const isRapid = mode.id === "rapid_fire";
  const identity = useMemo(() => readPlayerIdentity(sessionId), [sessionId]);
  const team = teams.find((item) => item.team_key === identity?.team_id) ?? null;
  const [phase, setPhase] = useState<Phase>(initialStatus === "ended" ? "ended" : "waiting");
  const [question, setQuestion] = useState<QuizPlayQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clockStart, setClockStart] = useState<number | null>(gameStartedAt ? Date.parse(gameStartedAt) : null);
  const [timeLimit, setTimeLimit] = useState(timePerQ || 30);
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
  const [skipIndex, setSkipIndex] = useState(-1);
  const [teamScore, setTeamScore] = useState(0);
  const [teamDelta, setTeamDelta] = useState(0);
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

  const totalTime = Number(modeConfig.total_time_seconds ?? timePerQ ?? 60);
  const teamBonus = Number(modeConfig.team_bonus_per_member ?? 20);

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
        team_id: result.participant.team_id ?? identity.team_id,
        team_name: result.participant.team_name ?? identity.team_name,
        team_color: result.participant.team_color ?? identity.team_color,
      });
    });
  }, [hostId, identity]);

  useEffect(() => {
    if (!identity) return;
    const client = createClient();
    const connection = playerConnect(
      client,
      sessionId,
      (event) => {
        handleEvent(event);
      },
      {
        hostId: identity.host_id ?? hostId,
        hostToken: identity.host_token,
        participantId: identity.participant_id,
      },
    );
    return () => connection.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, sessionId, hostId]);

  const remaining = isRapid
    ? clockStart
      ? Math.max(0, totalTime - Math.floor((now - clockStart) / 1000))
      : totalTime
    : paused && frozenRemaining != null
      ? Math.max(0, Math.ceil(frozenRemaining / 1000))
      : startedAt
        ? Math.max(0, timeLimit - Math.floor((now - startedAt) / 1000))
        : timeLimit;

  const frozen = isRapid && remaining === 0 && (phase === "question" || phase === "waiting" || phase === "locked");

  useEffect(() => {
    if (isRapid && remaining === 0 && phase !== "ended" && clockStart) {
      setPhase("ended");
      void finalLeaderboardAction(sessionId).then((result) => {
        if (result.ok) setBoard(result.rows as LeaderboardRow[]);
      });
    }
  }, [clockStart, isRapid, phase, remaining, sessionId]);

  useEffect(() => {
    if (isRapid || phase !== "question" || paused || !question || remaining > 0 || submitted.current) return;
    void lockIn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining, question, paused, isRapid]);

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
      const start = new Date(event.started_at).getTime();
      setStartedAt(start);
      if (isRapid) setClockStart((current) => current ?? start);
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
          if (earned > 0) {
            setTeamDelta(teamBonus);
            setTeamScore((value) => value + teamBonus);
          } else {
            setTeamDelta(0);
          }
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
      if (isRapid && typeof event.questionIndex === "number") {
        setSkipIndex(event.questionIndex);
        return;
      }
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
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{mode.name}</p>
        <h1 className="mt-3 font-display text-3xl">Waiting for first question</h1>
        <p className="mt-3 text-ivory/60">Stay on this screen, {identity.display_name}.</p>
        {team ? (
          <p className="mt-3 text-sm" style={{ color: team.color }}>
            Team {team.name}
          </p>
        ) : null}
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
        {team ? (
          <p className="mt-2 text-sm" style={{ color: team.color }}>
            Team {team.name}
          </p>
        ) : null}
        <ol className="mt-6 w-full max-w-sm space-y-2 text-left">
          {board.slice(0, 8).map((row) => (
            <li key={row.participant_id} className="flex items-center justify-between border border-white/10 px-3 py-2">
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
      {isRapid ? (
        <RapidFirePlayer
          identity={identity}
          questions={playQuestions}
          remaining={remaining}
          frozen={frozen || phase === "ended"}
          skipIndex={skipIndex}
          onDelta={(delta) => {
            setScore((value) => {
              const next = value + delta;
              scoreRef.current = next;
              return next;
            });
          }}
        />
      ) : mode.id === "team_battle" ? (
        <TeamBattlePlayer
          team={team ?? (identity.team_id ? { id: identity.team_id, instance_id: "", team_key: identity.team_id, name: identity.team_name ?? "Team", color: identity.team_color ?? "#9B5DE5" } : null)}
          teamScore={teamScore}
          teamDelta={teamDelta}
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
          onLock={(key) => void lockIn(key)}
        />
      ) : (
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
          onLock={(key) => void lockIn(key)}
        />
      )}
    </div>
  );
}
