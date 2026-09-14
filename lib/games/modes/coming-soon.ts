import type { GameModeDefinition } from "@/lib/games/modes/types";
import type { GameMode as ModeId } from "@/lib/games/types";

function stub(
  id: ModeId,
  name: string,
  shortDescription: string,
  accentColor: string,
  icon: string,
): GameModeDefinition {
  return {
    id,
    name,
    shortDescription,
    longDescription: `${shortDescription} This mode ships in a later 6D session.`,
    icon,
    accentColor,
    status: "coming_soon",
    configSchema: [],
    scoreResponse: () => ({ points: 0 }),
  };
}

export const caseStudyMode = stub(
  "case_study",
  "Case Study",
  "Multi-question vignette on one scenario.",
  "#2A9D8F",
  "▣",
);

export const adaptiveMode = stub(
  "adaptive",
  "Adaptive Drill",
  "Next question follows weak areas.",
  "#4C8BF5",
  "◎",
);

export const bossBattleMode = stub(
  "boss_battle",
  "Boss Battle",
  "Narrative campaign; correct answers advance the story.",
  "#E63946",
  "♛",
);
