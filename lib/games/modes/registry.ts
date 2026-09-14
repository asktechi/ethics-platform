import { adaptiveMode, bossBattleMode, caseStudyMode } from "@/lib/games/modes/coming-soon";
import { jeopardyMode } from "@/lib/games/modes/jeopardy";
import { rapidFireMode } from "@/lib/games/modes/rapid_fire";
import { teamBattleMode } from "@/lib/games/modes/team_battle";
import type { GameModeDefinition } from "@/lib/games/modes/types";

export const MODES: Record<string, GameModeDefinition> = {
  jeopardy: jeopardyMode,
  rapid_fire: rapidFireMode,
  team_battle: teamBattleMode,
  case_study: caseStudyMode,
  adaptive: adaptiveMode,
  boss_battle: bossBattleMode,
};

export function getMode(id: string | null | undefined): GameModeDefinition {
  if (id && MODES[id]) return MODES[id];
  if (id === "standard") return jeopardyMode;
  return jeopardyMode;
}

export function listModes(): GameModeDefinition[] {
  return Object.values(MODES);
}

export function listPlayableModeIds() {
  return listModes()
    .filter((mode) => mode.status === "playable")
    .map((mode) => mode.id);
}
