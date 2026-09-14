import type { GameModeDefinition, ScoreResponseArgs } from "@/lib/games/modes/types";

export function jeopardyScoreResponse({
  isCorrect,
  msTaken,
  timeLimitMs,
  basePoints,
  priorCorrect,
  timeBonusEnabled = true,
  streakBonusEnabled = true,
}: ScoreResponseArgs) {
  if (!isCorrect) return { points: 0 };
  const limit = Math.max(1, timeLimitMs);
  const elapsed = Math.min(Math.max(0, msTaken), limit);
  const timeBonus = timeBonusEnabled
    ? Math.min(100, Math.max(0, Math.round(100 * (1 - elapsed / limit))))
    : 0;
  const streakBonus = streakBonusEnabled ? 20 * Math.max(0, priorCorrect) : 0;
  return {
    points: basePoints + timeBonus + streakBonus,
    bonusReason: timeBonus || streakBonus ? `time +${timeBonus}, streak +${streakBonus}` : undefined,
  };
}

export const jeopardyMode: GameModeDefinition = {
  id: "jeopardy",
  name: "Jeopardy Classic",
  shortDescription: "One question at a time, timer, live leaderboard.",
  longDescription:
    "The host reveals one question to the room. Players lock in before the timer ends. Scores include a time bonus and a streak bonus.",
  icon: "◆",
  accentColor: "#C9A227",
  status: "playable",
  configSchema: [
    { key: "time_per_q", label: "Seconds per question", type: "number", default: 45, min: 5, max: 300 },
    { key: "base_points", label: "Base points", type: "number", default: 100, min: 0, max: 1000 },
    { key: "time_bonus", label: "Time bonus", type: "boolean", default: true },
    { key: "streak_bonus", label: "Streak bonus", type: "boolean", default: true },
  ],
  scoreResponse: jeopardyScoreResponse,
};
