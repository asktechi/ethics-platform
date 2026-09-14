"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdaptivePlayer } from "@/app/quiz/play/[sessionId]/modes/AdaptivePlayer";
import { BossBattlePlayer } from "@/app/quiz/play/[sessionId]/modes/BossBattlePlayer";
import { CaseStudyPlayer } from "@/app/quiz/play/[sessionId]/modes/CaseStudyPlayer";
import { JeopardyPlayer } from "@/app/quiz/play/[sessionId]/modes/JeopardyPlayer";
import { RapidFirePlayer } from "@/app/quiz/play/[sessionId]/modes/RapidFirePlayer";
import { TeamBattlePlayer } from "@/app/quiz/play/[sessionId]/modes/TeamBattlePlayer";
import { finalLeaderboardAction, myParticipantAction, submitAnswerAction } from "@/app/quiz/_actions/player.actions";
import { parseBossCombat, type BossCombatView } from "@/lib/games/boss-view";
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
  initialCombat,
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
  initialCombat?: unknown;
}) {
  const router = useRouter();
  const mode = getMode(modeId);
  const isRapid = mode.id === "rapid_fire";
  const isCase = mode.id === "case_study";
  const isAdaptive = mode.id === "adaptive";
  const isBoss = mode.id === "boss_battle";
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
  const [caseIntro, setCaseIntro] = useState<{ title: string; scenario: string } | null>(null);
  const [caseReady, setCaseReady] = useState(false);
  const [caseComplete, setCaseComplete] = useState(false);
  const [caseTitle, setCaseTitle] = useState<string | null>(null);
  const [adaptiveStarted, setAdaptiveStarted] = useState(Boolean(gameStartedAt));
  const [combat, setCombat] = useState<BossCombatView | null>(() => parseBossCombat(initialCombat));
  const [bossOverlay, setBossOverlay] = useState<{ phase: number; taunt: string } | null>(null);
  const [bossFlash, setBossFlash] = useState<{ kind: "damage" | "heal" | "party"; amount: number; streak?: number } | null>(null);
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
    if (event.type === "CASE_INTRO") {
      setCaseIntro({ title: event.title, scenario: event.scenario });
      setCaseTitle(event.title);
      setCaseReady(false);
      setCaseComplete(false);
      setPhase("waiting");
      return;
    }
    if (event.type === "CASE_COMPLETE") {
      setCaseComplete(true);
      setCaseIntro(null);
      setCaseReady(false);
      setPhase("waiting");
      return;
    }
    if (event.type === "ADAPTIVE_START") {
      setAdaptiveStarted(true);
      setPhase("question");
      return;
    }
    if (event.type === "QUESTION") {
      if (submitted.current && questionIdRef.current === event.question_id) {
        return;
      }
      submitted.current = false;
      questionIdRef.current = event.question_id;
      setCaseReady(true);
      setCaseComplete(false);
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
          if (isBoss) {
            if (earned > 0) {
              const multiplier = result.participant.streak >= 4 ? 2 : result.participant.streak >= 3 ? 1.5 : 1;
              setBossFlash({ kind: "damage", amount: earned, streak: multiplier > 1 ? multiplier : undefined });
            } else if (picked) {
              setBossFlash({
                kind: modeConfig.wrong_answer_penalty === "party_damage" ? "party" : "heal",
                amount: Number(
                  modeConfig.wrong_answer_penalty === "party_damage"
                    ? modeConfig.party_damage_amount ?? 20
                    : modeConfig.boss_heal_amount ?? 15,
                ),
              });
            }
            window.setTimeout(() => setBossFlash(null), 1600);
          }
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
    if (event.type === "BOSS_HP") {
      setCombat((current) =>
        current
          ? { ...current, boss_hp: event.boss_hp, boss_max_hp: event.boss_max_hp }
          : parseBossCombat({
              boss_hp: event.boss_hp,
              boss_max_hp: event.boss_max_hp,
              party_hp: null,
              party_max_hp: 300,
              phase: 1,
              play_mode: "co-op",
              outcome: "ongoing",
              log: [],
              boss: null,
            }),
      );
      if (event.source === "correct" && event.delta < 0) {
        setBossFlash({ kind: "damage", amount: Math.abs(event.delta), streak: streak > 1 ? undefined : undefined });
        window.setTimeout(() => setBossFlash(null), 1600);
      } else if (event.source === "heal") {
        setBossFlash({ kind: "heal", amount: Math.abs(event.delta) });
        window.setTimeout(() => setBossFlash(null), 1600);
      }
      return;
    }
    if (event.type === "PARTY_HP") {
      setCombat((current) => (current ? { ...current, party_hp: event.party_hp, party_max_hp: event.party_max_hp } : current));
      if (event.delta < 0) {
        setBossFlash({ kind: "party", amount: Math.abs(event.delta) });
        window.setTimeout(() => setBossFlash(null), 1600);
      }
      return;
    }
    if (event.type === "BOSS_PHASE") {
      setCombat((current) => (current ? { ...current, phase: event.phase, taunt: event.taunt } : current));
      setBossOverlay({ phase: event.phase, taunt: event.taunt });
      window.setTimeout(() => setBossOverlay(null), 3000);
      return;
    }
    if (event.type === "BOSS_VICTORY") {
      setCombat((current) => (current ? { ...current, outcome: "victory", boss_hp: 0 } : current));
      setPhase("ended");
      void finalLeaderboardAction(sessionId).then((result) => {
        if (result.ok) setBoard(result.rows as LeaderboardRow[]);
      });
      return;
    }
    if (event.type === "BOSS_DEFEAT") {
      setCombat((current) =>
        current
          ? {
              ...current,
              outcome: "defeat",
              defeat_reason: event.reason,
              boss_hp: event.remaining_hp ?? current.boss_hp,
            }
          : current,
      );
      setPhase("ended");
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

  if (phase === "waiting" && !isAdaptive && !(isCase && (caseIntro || caseComplete))) {
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

  if (phase === "ended" && !(isBoss && combat && combat.outcome !== "ongoing")) {
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
          frozen={frozen}
          skipIndex={skipIndex}
          onDelta={(delta) => {
            setScore((value) => {
              const next = value + delta;
              scoreRef.current = next;
              return next;
            });
          }}
        />
      ) : isAdaptive ? (
        <AdaptivePlayer
          identity={identity}
          sessionId={sessionId}
          started={adaptiveStarted}
          allowHint={modeConfig.allow_hint !== false}
          onDelta={(delta) => {
            setScore((value) => {
              const next = value + delta;
              scoreRef.current = next;
              return next;
            });
          }}
        />
      ) : isCase || caseIntro || caseComplete ? (
        <CaseStudyPlayer
          intro={caseIntro}
          complete={caseComplete}
          ready={caseReady}
          onReady={() => setCaseReady(true)}
          caseTitle={caseTitle}
          question={question}
          questionIndex={questionIndex}
          questionCount={questionCount}
          remaining={remaining}
          phase={phase === "waiting" ? "question" : phase}
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
      ) : isBoss ? (
        <BossBattlePlayer
          combat={combat}
          overlay={bossOverlay}
          flash={bossFlash}
          sessionId={sessionId}
          players={board.map((row) => ({ id: row.participant_id, display_name: row.display_name, score: row.score }))}
          responses={[]}
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
