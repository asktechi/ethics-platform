"use client";

import { motion } from "framer-motion";
import { JeopardyPlayer } from "@/app/quiz/play/[sessionId]/modes/JeopardyPlayer";
import {
  BossOutcomeScreen,
  HpBar,
  PhaseOverlay,
  hpBarColor,
} from "@/components/quiz/BossChrome";
import type { BossCombatView } from "@/lib/data/bosses";
import type { QuizPlayQuestion } from "@/lib/quiz/types";

export function BossBattlePlayer({
  combat,
  overlay,
  flash,
  sessionId,
  players,
  responses,
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
}: {
  combat: BossCombatView | null;
  overlay: { phase: number; taunt: string } | null;
  flash: { kind: "damage" | "heal" | "party"; amount: number; streak?: number } | null;
  sessionId: string;
  players: Array<{ id: string; display_name: string; score: number }>;
  responses: Array<{ ms_taken: number | null }>;
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
}) {
  const boss = combat?.boss;
  const palette = boss?.palette_json ?? {};
  const max = combat?.boss_max_hp ?? boss?.max_hp ?? 400;
  const hp = combat?.boss_hp ?? max;
  const ratio = max <= 0 ? 0 : hp / max;
  const ended = combat?.outcome === "victory" || combat?.outcome === "defeat";

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {combat && ended ? (
        <BossOutcomeScreen
          combat={combat}
          players={players}
          responses={responses}
          sessionId={sessionId}
          role="player"
        />
      ) : null}
      <PhaseOverlay
        open={Boolean(overlay)}
        phase={overlay?.phase ?? combat?.phase ?? 1}
        taunt={overlay?.taunt ?? ""}
        accent={palette.accent ?? "#E63946"}
        emoji={boss?.portrait_emoji}
        url={boss?.portrait_url}
        name={boss?.name ?? "Boss"}
      />
      {flash ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.45, 0], x: flash.kind === "heal" ? [0, -6, 6, 0] : 0 }}
          transition={{ duration: 0.7 }}
          style={{
            background:
              flash.kind === "damage" ? "radial-gradient(circle, #22c55e55, transparent 70%)" : "#ef444433",
          }}
        />
      ) : null}
      <div className="mb-3 shrink-0 space-y-2">
        <HpBar label={boss?.name ?? "Boss"} current={hp} max={max} color={hpBarColor(ratio, palette.hpBar)} />
        {combat?.play_mode === "co-op" && combat.party_hp != null ? (
          <HpBar label="Party" current={combat.party_hp} max={combat.party_max_hp} color="#38BDF8" />
        ) : null}
        {flash ? (
          <p
            className={`text-center font-display text-lg ${
              flash.kind === "damage" ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {flash.kind === "damage"
              ? `You dealt ${flash.amount} damage!`
              : flash.kind === "party"
                ? `The party took ${flash.amount} damage`
                : `The boss healed ${flash.amount} HP`}
            {flash.streak && flash.streak > 1 ? `  Streak x${flash.streak}!` : ""}
          </p>
        ) : null}
      </div>
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
      />
    </div>
  );
}
