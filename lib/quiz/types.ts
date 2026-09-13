export type QuizMode = "jeopardy" | "standard";

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

export type QuizEvent =
  | {
      type: "QUESTION";
      questionIndex: number;
      question_id: string;
      stem: string;
      choices: QuizChoice[];
      time_limit_seconds: number;
      started_at: string;
    }
  | {
      type: "REVEAL";
      question_id: string;
      correct_key: string;
      explanation: string;
    }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END" }
  | { type: "HYDRATE"; state: Partial<QuizBusState> };

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
};

export type PlayerIdentity = {
  participant_id: string;
  session_id: string;
  participant_token: string;
  display_name: string;
  avatar_color: string;
};

export type LeaderboardRow = {
  participant_id: string;
  display_name: string;
  score: number;
  streak: number;
  avatar_color: string | null;
  rank: number;
};
