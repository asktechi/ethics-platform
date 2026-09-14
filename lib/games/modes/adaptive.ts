import { jeopardyScoreResponse } from "@/lib/games/modes/jeopardy";
import type { GameModeDefinition } from "@/lib/games/modes/types";

export const adaptiveMode: GameModeDefinition = {
  id: "adaptive",
  name: "Adaptive Drill",
  shortDescription: "Next question follows weak areas.",
  longDescription:
    "Each player gets a personal queue. After every answer the next item is chosen from remaining pool questions, preferring weak Standards. Optional hints cost points.",
  icon: "◎",
  accentColor: "#4C8BF5",
  status: "playable",
  configSchema: [
    { key: "total_questions", label: "Questions per player", type: "number", default: 15, min: 1, max: 50 },
    { key: "prefer_weak", label: "Prefer weak Standards", type: "boolean", default: true },
    { key: "avoid_recent_days", label: "Avoid recently correct (days)", type: "number", default: 14, min: 0, max: 90 },
    {
      key: "min_questions_per_standard",
      label: "Minimum questions per Standard",
      type: "number",
      default: 2,
      min: 0,
      max: 10,
    },
    { key: "difficulty_ramp", label: "Ramp difficulty with streak", type: "boolean", default: true },
    { key: "allow_hint", label: "Allow hints", type: "boolean", default: true },
    { key: "hint_penalty", label: "Hint penalty (points)", type: "number", default: 50, min: 0, max: 200 },
  ],
  scoreResponse: jeopardyScoreResponse,
};
