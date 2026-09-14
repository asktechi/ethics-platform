import type { ComponentType } from "react";
import type { GameMode } from "@/lib/games/types";
import type { QuizHostQuestion, QuizPlayQuestion } from "@/lib/quiz/types";

export type ModeConfigField = {
  key: string;
  label: string;
  type: "number" | "boolean" | "string";
  default: string | number | boolean;
  min?: number;
  max?: number;
};

export type ScoreResponseArgs = {
  isCorrect: boolean;
  msTaken: number;
  timeLimitMs: number;
  basePoints: number;
  priorCorrect: number;
  teamId?: string;
  teamCorrectSoFar?: number;
  wrongPenalty?: number;
  timeBonusEnabled?: boolean;
  streakBonusEnabled?: boolean;
  teamBonusPerMember?: number;
  difficulty?: string | null;
  baseDamage?: number;
  timeBonusDamage?: number;
  wrongAnswerPenalty?: "boss_heal" | "party_damage";
  streakDamageMultiplier?: boolean;
};

export type ScoreResponseResult = {
  points: number;
  bonusReason?: string;
};

export type SessionEndSummary = {
  title: string;
  subtitle?: string;
  winningTeamKey?: string;
  mvpParticipantId?: string;
};

export type HostContext = {
  sessionId: string;
  modeId: GameMode;
  questionCount: number;
  settings: Record<string, unknown>;
};

export type HostExtraPanelProps = {
  sessionId: string;
  questions: QuizHostQuestion[];
  index: number;
  phase: string;
  remaining: number;
  players: Array<{
    id: string;
    display_name: string;
    score: number;
    streak: number;
    avatar_color: string | null;
    connected?: boolean;
    team_id?: string | null;
  }>;
  responses: Array<{
    participant_id: string;
    question_id: string;
    choice_key: string | null;
    ms_taken: number | null;
    is_correct: boolean | null;
  }>;
  teams: GameTeamRecord[];
  modeConfig: Record<string, unknown>;
  onSkip?: () => void;
};

export type PlayerExtraPanelProps = {
  sessionId: string;
  question: QuizPlayQuestion | null;
  phase: string;
  score: number;
  lastDelta: number | "missed" | null;
  team?: GameTeamRecord | null;
  teamDelta?: number;
  teamScore?: number;
};

export type GameTeamRecord = {
  id: string;
  instance_id: string;
  team_key: string;
  name: string;
  color: string;
  created_at?: string;
};

export interface GameModeDefinition {
  id: GameMode;
  name: string;
  shortDescription: string;
  longDescription: string;
  icon: string;
  accentColor: string;
  status: "playable" | "coming_soon";

  configSchema: ModeConfigField[];

  scoreResponse(args: ScoreResponseArgs): ScoreResponseResult;

  onSessionStart?(ctx: HostContext): Promise<void>;
  onQuestionStart?(ctx: HostContext, qIndex: number): Promise<void>;
  onAnswerReveal?(ctx: HostContext, qIndex: number): Promise<void>;
  onSessionEnd?(ctx: HostContext): Promise<SessionEndSummary>;

  HostExtraPanel?: ComponentType<HostExtraPanelProps>;
  PlayerExtraPanel?: ComponentType<PlayerExtraPanelProps>;
}

export const TEAM_PALETTE = [
  { key: "red", name: "Red", color: "#DC2626" },
  { key: "blue", name: "Blue", color: "#2563EB" },
  { key: "green", name: "Green", color: "#16A34A" },
  { key: "yellow", name: "Yellow", color: "#CA8A04" },
] as const;

export function teamsFromCount(count: number) {
  const n = Math.min(4, Math.max(2, Math.round(count) || 4));
  return TEAM_PALETTE.slice(0, n).map((team) => ({
    team_key: team.key,
    name: team.name,
    color: team.color,
  }));
}

export function schemaDefaults(schema: ModeConfigField[]) {
  return Object.fromEntries(schema.map((field) => [field.key, field.default])) as Record<
    string,
    string | number | boolean
  >;
}
