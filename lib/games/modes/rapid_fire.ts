import type { GameModeDefinition } from "@/lib/games/modes/types";

export const rapidFireMode: GameModeDefinition = {
  id: "rapid_fire",
  name: "Rapid Fire",
  shortDescription: "60-second sprint, as many questions as possible.",
  longDescription:
    "One shared clock for the whole room. Players answer independently, get instant feedback, and move to the next question. When the clock hits zero, everyone freezes.",
  icon: "⚡",
  accentColor: "#E07A3D",
  status: "playable",
  configSchema: [
    { key: "total_time_seconds", label: "Total time (seconds)", type: "number", default: 60, min: 10, max: 300 },
    { key: "questions_unlimited", label: "Unlimited questions", type: "boolean", default: true },
    { key: "questions_max", label: "Max questions", type: "number", default: 30, min: 5, max: 100 },
    { key: "wrong_answer_penalty", label: "Wrong-answer penalty", type: "number", default: 0, min: 0, max: 500 },
    { key: "score_per_correct", label: "Points per correct", type: "number", default: 100, min: 1, max: 1000 },
  ],
  scoreResponse({ isCorrect, basePoints, wrongPenalty = 0 }) {
    if (isCorrect) return { points: basePoints };
    return { points: -Math.abs(wrongPenalty) };
  },
};
