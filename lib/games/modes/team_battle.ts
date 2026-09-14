import { jeopardyScoreResponse } from "@/lib/games/modes/jeopardy";
import type { GameModeDefinition } from "@/lib/games/modes/types";

export const teamBattleMode: GameModeDefinition = {
  id: "team_battle",
  name: "Team Battle",
  shortDescription: "Class split into teams; scores accumulate.",
  longDescription:
    "Players are assigned to colored teams. Gameplay matches Jeopardy. Each correct answer also contributes a team bonus. The final board ranks teams first, then individuals.",
  icon: "⚑",
  accentColor: "#9B5DE5",
  status: "playable",
  configSchema: [
    { key: "team_count", label: "Number of teams", type: "number", default: 4, min: 2, max: 4 },
    { key: "team_assignment_mode", label: "Team assignment", type: "string", default: "auto" },
    { key: "base_points", label: "Base points", type: "number", default: 100, min: 0, max: 1000 },
    { key: "time_bonus", label: "Time bonus", type: "boolean", default: true },
    { key: "streak_bonus", label: "Streak bonus", type: "boolean", default: true },
    { key: "team_bonus_per_member", label: "Team bonus per correct", type: "number", default: 20, min: 0, max: 200 },
  ],
  scoreResponse(args) {
    return jeopardyScoreResponse(args);
  },
};
