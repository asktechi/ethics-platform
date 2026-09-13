export type DifficultyHint = "easy" | "medium" | "hard";

export type CanonicalChoice = {
  key: string;
  text: string;
};

export type CanonicalQuestion = {
  id: string;
  stem: string;
  choices: CanonicalChoice[];
  answer_key: string | null;
  explanation: string | null;
  standard_hint: string | null;
  concept_hint: string | null;
  difficulty_hint: DifficultyHint | null;
  warnings: string[];
  source: {
    file: string;
    slide_or_page: number | null;
    row: number | null;
  };
  raw_text: string;
};

export type ParseResult = {
  file: string;
  fileType: string;
  questions: CanonicalQuestion[];
  globalWarnings: string[];
  detectedPattern: string;
};

export type RawQuestion = {
  stem: string;
  choices: CanonicalChoice[];
  answer_key?: string | null;
  explanation?: string | null;
  standard_hint?: string | null;
  concept_hint?: string | null;
  difficulty_hint?: DifficultyHint | null;
  slide_or_page?: number | null;
  row?: number | null;
  raw_text: string;
};

export type StrategyResult = {
  pattern: string;
  questions: RawQuestion[];
  warnings: string[];
  /** When set, importFile uses these as-is (already grammar-normalized). */
  canonicalQuestions?: CanonicalQuestion[];
};

export type ImportFileType =
  | "csv"
  | "tsv"
  | "xlsx"
  | "xls"
  | "docx"
  | "doc"
  | "pdf"
  | "pptx"
  | "txt"
  | "unknown";
