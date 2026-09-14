export type GameMode =
  | "jeopardy"
  | "rapid_fire"
  | "case_study"
  | "team_battle"
  | "adaptive"
  | "boss_battle";

export type GameFilter = {
  standards: string[];
  concepts: string[];
  difficulty: Array<"easy" | "medium" | "hard">;
  sources: Array<"imported" | "ai_generated" | "mine">;
  approved_only: boolean;
  search?: string;
};

export type GameSettings = {
  time_per_q: number;
  base_points: number;
  time_bonus: boolean;
  streak_bonus: boolean;
  shuffle_questions: boolean;
  show_leaderboard_to_players: boolean;
  show_correct_answer_after: boolean;
  allow_late_join: boolean;
  allow_audience_advance: boolean;
  allow_replay: boolean;
  rehearsal_mode: boolean;
  auto_reveal_chime: boolean;
};

export type GameSource = "pool" | "filter";

export type WizardState = {
  classId: string;
  name: string;
  description: string;
  tags: string[];
  source: GameSource;
  poolId: string;
  filter: GameFilter;
  mode: GameMode;
  settings: GameSettings;
  modeConfig: Record<string, string | number | boolean>;
  caseStudyIds: string[];
  bossId?: string | null;
};

export const defaultGameSettings = (): GameSettings => ({
  time_per_q: 45,
  base_points: 100,
  time_bonus: true,
  streak_bonus: true,
  shuffle_questions: true,
  show_leaderboard_to_players: true,
  show_correct_answer_after: true,
  allow_late_join: true,
  allow_audience_advance: false,
  allow_replay: true,
  rehearsal_mode: false,
  auto_reveal_chime: false,
});

export const defaultGameFilter = (): GameFilter => ({
  standards: [],
  concepts: [],
  difficulty: [],
  sources: [],
  approved_only: true,
});

export const MODE_META: Record<
  GameMode,
  { label: string; blurb: string; accent: string; playable: boolean }
> = {
  jeopardy: {
    label: "Jeopardy Classic",
    blurb: "One question at a time, timer, live leaderboard.",
    accent: "#C9A227",
    playable: true,
  },
  rapid_fire: {
    label: "Rapid Fire",
    blurb: "60-second sprint, as many questions as possible.",
    accent: "#E07A3D",
    playable: true,
  },
  case_study: {
    label: "Case Study",
    blurb: "Multi-question vignette on one scenario.",
    accent: "#2A9D8F",
    playable: true,
  },
  team_battle: {
    label: "Team Battle",
    blurb: "Class split into teams; scores accumulate.",
    accent: "#9B5DE5",
    playable: true,
  },
  adaptive: {
    label: "Adaptive Drill",
    blurb: "Next question follows weak areas.",
    accent: "#4C8BF5",
    playable: true,
  },
  boss_battle: {
    label: "Boss Battle",
    blurb: "Narrative campaign; correct answers deal damage.",
    accent: "#E63946",
    playable: true,
  },
};

export const COVER_PALETTES = ["#C9A227", "#E07A3D", "#2A9D8F", "#4C8BF5", "#9B5DE5", "#E63946"];

export function coverColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % COVER_PALETTES.length;
  }
  return COVER_PALETTES[hash] ?? COVER_PALETTES[0];
}

export type SettingsSnapshot = {
  settings: GameSettings;
  time_per_q: number;
  mode: GameMode;
  question_ids: string[];
  pool_id?: string | null;
  filter?: GameFilter | null;
  name?: string;
  mode_config?: Record<string, string | number | boolean>;
  case_study_ids?: string[];
  boss_id?: string | null;
};
