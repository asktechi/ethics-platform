export type ParsedChoice = {
  key: string;
  text: string;
};

export type ParsedQuestion = {
  stem: string;
  choices: ParsedChoice[];
  answer_key: string;
  explanation?: string;
  source_line?: number;
  flagged?: boolean;
};

export type ParseQuestionsResult = {
  questions: ParsedQuestion[];
  warnings: string[];
};

export type QuestionHint = "mcq" | "open" | "this is a 4-choice MCQ set" | string;
