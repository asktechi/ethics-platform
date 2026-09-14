import type { GameModeDefinition } from "@/lib/games/modes/types";

export const bossBattleMode: GameModeDefinition = {
  id: "boss_battle",
  name: "Boss Battle",
  shortDescription: "Narrative campaign; correct answers advance the story.",
  longDescription:
    "Narrative campaign; correct answers advance the story. This mode ships in a later 6D session.",
  icon: "♛",
  accentColor: "#E63946",
  status: "coming_soon",
  configSchema: [],
  scoreResponse: () => ({ points: 0 }),
};
