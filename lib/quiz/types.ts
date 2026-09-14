export type QuizMode = "jeopardy" | "standard" | "rapid_fire" | "team_battle" | "case_study" | "adaptive" | "boss_battle";

export type QuizChoice = { key: string; text: string };

export type QuizPlayQuestion = {
  question_id: string;
  stem: string;
  choices: QuizChoice[];
  time_limit_seconds: number;
};

export type QuizHostQuestion = QuizPlayQuestion & {
  answer_key: string;
  explanation: string | null;
};

export type QuizEventEnvelope = {
  sender?: string;
  host_token?: string;
};

export type QuizEvent =
  | ({
      type: "QUESTION";
      questionIndex: number;
      question_id: string;
      stem: string;
      choices: QuizChoice[];
      time_limit_seconds: number;
      started_at: string;
    } & QuizEventEnvelope)
  | ({
      type: "REVEAL";
      question_id: string;
      correct_key: string;
      explanation: string;
    } & QuizEventEnvelope)
  | ({ type: "NEXT" } & QuizEventEnvelope)
  | ({ type: "PREV" } & QuizEventEnvelope)
  | ({ type: "PAUSE"; remaining_ms?: number } & QuizEventEnvelope)
  | ({ type: "RESUME"; started_at?: string; remaining_ms?: number } & QuizEventEnvelope)
  | ({ type: "SKIP"; question_id?: string; questionIndex?: number } & QuizEventEnvelope)
  | ({ type: "END"; early?: boolean } & QuizEventEnvelope)
  | ({
      type: "HIGHLIGHT";
      display_name: string;
      avatar_color?: string | null;
      ms_taken: number;
      points: number;
    } & QuizEventEnvelope)
  | ({ type: "HYDRATE"; state: Partial<QuizBusState> } & QuizEventEnvelope);

export type QuizEventType = QuizEvent["type"];

export type QuizEventOrigin = "local" | "remote";

export type QuizBusState = {
  sessionId: string | null;
  questionIndex: number;
  questionCount: number;
  isPaused: boolean;
  ended: boolean;
  revealOpen: boolean;
  currentQuestionId: string | null;
};

export type QuizSettings = {
  allow_late_join: boolean;
  show_leaderboard: boolean;
  show_correct_answer: boolean;
  shuffle: boolean;
  question_ids: string[];
  host_token?: string;
  paused_at?: string | null;
  remaining_ms?: number | null;
  question_started_at?: string | null;
  last_revealed_question_id?: string | null;
  scored_question_ids?: string[];
  mode_config?: Record<string, string | number | boolean>;
  name?: string;
  base_points?: number;
  time_bonus?: boolean;
  streak_bonus?: boolean;
  game_started_at?: string | null;
};

export type PlayerIdentity = {
  participant_id: string;
  session_id: string;
  participant_token: string;
  display_name: string;
  avatar_color: string;
  host_id?: string;
  host_token?: string;
  student_code?: string;
  team_id?: string | null;
  team_name?: string | null;
  team_color?: string | null;
};

export type LeaderboardRow = {
  participant_id: string;
  display_name: string;
  score: number;
  streak: number;
  avatar_color: string | null;
  rank: number;
};
