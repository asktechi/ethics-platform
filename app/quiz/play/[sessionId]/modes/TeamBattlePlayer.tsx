"use client";

import { JeopardyPlayer } from "@/app/quiz/play/[sessionId]/modes/JeopardyPlayer";
import type { GameTeamRecord } from "@/lib/games/modes/types";
import type { QuizPlayQuestion } from "@/lib/quiz/types";

export function TeamBattlePlayer({
  team,
  teamScore,
  teamDelta,
  ...props
}: {
  team?: GameTeamRecord | null;
  teamScore?: number;
  teamDelta?: number;
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
  return (
    <>
      {team ? (
        <div
          className="mb-3 flex items-center justify-between border px-3 py-2 text-sm"
          style={{ borderColor: team.color, color: team.color }}
        >
          <span>{team.name}</span>
          <span>{teamScore ?? 0} team pts</span>
        </div>
      ) : null}
      <JeopardyPlayer {...props} />
      {props.phase === "reveal" && team ? (
        <p className="mt-2 text-center text-sm" style={{ color: team.color }}>
          Team {team.name}: {teamScore ?? 0}
          {typeof teamDelta === "number" && teamDelta > 0 ? ` (+${teamDelta})` : ""}
        </p>
      ) : null}
    </>
  );
}
