/**
 * CANONICAL QUESTION GRAMMAR (v1)
 *
 * A question block starts with a QUESTION MARKER on its own line:
 *   ^Q\d+[.):]\s+          (e.g., "Q1. ", "Q42) ", "Q7: ")
 *   ^Question \d+[.):]\s+  (alternate)
 *   ^\d+[.):]\s+           (loose — used when the file has no Q/Question
 *                            markers, or after a completed question when
 *                            mixed marker styles appear in one file)
 *
 * Followed by:
 *   - The stem: one or more lines of prose
 *   - A blank line (recommended but not required)
 *   - Choice lines: ^([A-F])[.)]\s+(.+)
 *     Minimum 2 choices, maximum 6
 *   - A blank line (recommended)
 *   - Metadata lines (each on its own line):
 *       ^Standard[:.]\s+(.+)
 *       ^Answer[:.]\s+([A-F])
 *       ^Explanation[:.]\s+(.+)$   (Explanation may span multiple
 *                                    following lines until the next
 *                                    Q marker or separator)
 *
 * DECORATIVE LINES TO IGNORE (never treated as content):
 *   - Lines that are only one of: =, -, _, *, #, ~ (3 or more chars)
 *   - Lines matching /^=+\s*(START|END|BEGIN|STOP)\s*=+$/i
 *   - Lines matching /^\s*Page \d+\s*$/i
 *   - Lines that are just a number on their own
 *   - Lines matching /^Table of Contents$/i
 *   - Lines matching /^Answer Key$/i
 *   - Front-matter before the FIRST Q marker (title, author, date)
 *
 * SEPARATORS between questions (optional, ignored):
 *   - A line of only dashes: ---, ———
 *   - A blank line alone is NOT sufficient to end a question — only
 *     a new Q marker or a metadata block ends the current question.
 */

import { normalizeDifficulty, normalizeQuestion } from "@/lib/importers/normalize";
import type { CanonicalChoice, CanonicalQuestion, RawQuestion } from "@/lib/importers/types";

export const GRAMMAR_PATTERN = "grammar-v1";

export type TokenType =
  | "question-start"
  | "stem-line"
  | "choice"
  | "metadata"
  | "explanation-line"
  | "blank"
  | "decorative"
  | "unknown";

export type Token = {
  type: TokenType;
  raw: string;
  lineNumber: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
};

export type GrammarQuestionInput = {
  stem: string;
  choices: CanonicalChoice[];
  answer_key?: string | null;
  explanation?: string | null;
  standard_hint?: string | null;
  concept_hint?: string | null;
  difficulty_hint?: string | null;
};

const STRONG_Q = /^(Q\d+)([.):])\s+(.*)$/;
const QUESTION_WORD = /^(Question\s+\d+)([.):])\s+(.*)$/i;
const LOOSE_Q = /^(\d+)([.):])\s+(.*)$/;
const CHOICE = /^([A-F])[.)]\s+(.+)$/;
const STANDARD = /^Standard[:.]\s+(.+)$/i;
const ANSWER = /^Answer[:.]\s+([A-F])\b/i;
const EXPLANATION = /^Explanation[:.]\s+(.*)$/i;
const CONCEPT = /^Concept[:.]\s+(.+)$/i;
const DIFFICULTY = /^Difficulty[:.]\s+(.+)$/i;
const DECORATIVE_RUN = /^[=*_#~\-]{3,}$/;
const DECORATIVE_DASH = /^[—–-]{3,}$/;
const DECORATIVE_GATE = /^=+\s*(START|END|BEGIN|STOP)\s*=+$/i;

export function normalizeSourceText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function isDecorativeLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (DECORATIVE_RUN.test(trimmed)) return true;
  if (DECORATIVE_DASH.test(trimmed)) return true;
  if (DECORATIVE_GATE.test(trimmed)) return true;
  if (/^\s*Page \d+\s*$/i.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^Table of Contents$/i.test(trimmed)) return true;
  if (/^Answer Key$/i.test(trimmed)) return true;
  return false;
}

export function tokenize(text: string): Token[] {
  const lines = normalizeSourceText(text).split("\n");
  return lines.map((raw, index) => classifyLine(raw, index + 1));
}

function classifyLine(raw: string, lineNumber: number): Token {
  const trimmed = raw.trim();
  if (!trimmed) return { type: "blank", raw, lineNumber };

  if (isDecorativeLine(trimmed)) {
    return { type: "decorative", raw, lineNumber };
  }

  const standard = trimmed.match(STANDARD);
  if (standard) {
    return { type: "metadata", raw, lineNumber, payload: { kind: "standard", value: standard[1].trim() } };
  }
  const answer = trimmed.match(ANSWER);
  if (answer) {
    return { type: "metadata", raw, lineNumber, payload: { kind: "answer", value: answer[1].toUpperCase() } };
  }
  const explanation = trimmed.match(EXPLANATION);
  if (explanation) {
    return {
      type: "metadata",
      raw,
      lineNumber,
      payload: { kind: "explanation", value: explanation[1].trim() },
    };
  }
  const concept = trimmed.match(CONCEPT);
  if (concept) {
    return { type: "metadata", raw, lineNumber, payload: { kind: "concept", value: concept[1].trim() } };
  }
  const difficulty = trimmed.match(DIFFICULTY);
  if (difficulty) {
    return { type: "metadata", raw, lineNumber, payload: { kind: "difficulty", value: difficulty[1].trim() } };
  }

  const choice = trimmed.match(CHOICE);
  if (choice) {
    return {
      type: "choice",
      raw,
      lineNumber,
      payload: { key: choice[1].toUpperCase(), text: choice[2].trim() },
    };
  }

  const strong = trimmed.match(STRONG_Q);
  if (strong) {
    return {
      type: "question-start",
      raw,
      lineNumber,
      payload: { style: "q", marker: strong[1], rest: strong[3] },
    };
  }
  const questionWord = trimmed.match(QUESTION_WORD);
  if (questionWord) {
    return {
      type: "question-start",
      raw,
      lineNumber,
      payload: { style: "question", marker: questionWord[1], rest: questionWord[3] },
    };
  }
  const loose = trimmed.match(LOOSE_Q);
  if (loose) {
    return {
      type: "question-start",
      raw,
      lineNumber,
      payload: { style: "loose", marker: loose[1], rest: loose[3] },
    };
  }

  return { type: "unknown", raw, lineNumber, payload: { text: trimmed } };
}

type Draft = {
  stemLines: string[];
  choices: CanonicalChoice[];
  answer_key: string | null;
  explanationLines: string[];
  standard_hint: string | null;
  concept_hint: string | null;
  difficulty_hint: string | null;
  rawLines: string[];
  hasMetadata: boolean;
  inExplanation: boolean;
  row: number;
};

function emptyDraft(row: number): Draft {
  return {
    stemLines: [],
    choices: [],
    answer_key: null,
    explanationLines: [],
    standard_hint: null,
    concept_hint: null,
    difficulty_hint: null,
    rawLines: [],
    hasMetadata: false,
    inExplanation: false,
    row,
  };
}

function isStrongStart(token: Token) {
  return token.type === "question-start" && token.payload?.style !== "loose";
}

function draftCompleteEnough(draft: Draft | null) {
  if (!draft) return false;
  return draft.choices.length >= 2 || draft.hasMetadata;
}

function appendStem(draft: Draft, text: string) {
  if (text.trim()) draft.stemLines.push(text.trim());
}

function toRaw(draft: Draft): RawQuestion {
  return {
    stem: draft.stemLines.join(" "),
    choices: draft.choices.slice(0, 6),
    answer_key: draft.answer_key,
    explanation: draft.explanationLines.join(" ").trim() || null,
    standard_hint: draft.standard_hint,
    concept_hint: draft.concept_hint,
    difficulty_hint: normalizeDifficulty(draft.difficulty_hint),
    row: draft.row,
    raw_text: draft.rawLines.join("\n").trim(),
  };
}

export function buildQuestions(
  tokens: Token[],
  file = "",
): { questions: CanonicalQuestion[]; warnings: string[] } {
  const fileHasStrong = tokens.some(isStrongStart);
  const warnings: string[] = [];
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let seenStrong = false;
  let questionIndex = 0;

  const startQuestion = (rest: string, token: Token, rowHint?: number) => {
    current = emptyDraft(rowHint ?? ++questionIndex);
    current.rawLines.push(token.raw);
    if (rest.trim()) current.stemLines.push(rest.trim());
  };

  const flush = () => {
    if (!current) return;
    drafts.push(current);
    current = null;
  };

  for (const token of tokens) {
    if (token.type === "decorative") {
      if (current?.inExplanation) current.inExplanation = false;
      continue;
    }
    if (token.type === "blank") {
      if (current?.inExplanation && current.explanationLines.length) {
        // keep paragraph break out of joined stem; ignore for structure
      }
      continue;
    }

    if (token.type === "question-start") {
      const rest = String(token.payload?.rest ?? "");
      const loose = token.payload?.style === "loose";
      if (!loose) {
        seenStrong = true;
        flush();
        startQuestion(rest, token);
        continue;
      }
      if (fileHasStrong && !seenStrong) {
        continue;
      }
      if (!current || draftCompleteEnough(current)) {
        flush();
        startQuestion(rest, token);
        continue;
      }
      current.rawLines.push(token.raw);
      appendStem(current, `${token.payload?.marker ?? ""}. ${rest}`.replace(/^\d+\.\s+/, rest));
      continue;
    }

    if (!current) {
      continue;
    }

    current.rawLines.push(token.raw);

    if (token.type === "choice") {
      if (current.choices.length >= 6) {
        warnings.push(`Question ${current.row}: more than 6 choices; extras ignored`);
        continue;
      }
      current.choices.push({
        key: String(token.payload.key),
        text: String(token.payload.text ?? ""),
      });
      current.inExplanation = false;
      continue;
    }

    if (token.type === "metadata") {
      const kind = String(token.payload?.kind ?? "");
      const value = String(token.payload?.value ?? "").trim();
      current.hasMetadata = true;
      if (kind === "standard") {
        current.standard_hint = value || null;
        current.inExplanation = false;
      } else if (kind === "answer") {
        current.answer_key = value || null;
        current.inExplanation = false;
      } else if (kind === "explanation") {
        if (value) current.explanationLines.push(value);
        current.inExplanation = true;
      } else if (kind === "concept") {
        current.concept_hint = value || null;
        current.inExplanation = false;
      } else if (kind === "difficulty") {
        current.difficulty_hint = value || null;
        current.inExplanation = false;
      }
      continue;
    }

    const line = String(token.payload?.text ?? token.raw).trim();
    if (!line) continue;

    if (current.inExplanation || current.hasMetadata) {
      current.explanationLines.push(line);
      current.inExplanation = true;
      continue;
    }
    if (current.choices.length >= 2) {
      current.explanationLines.push(line);
      current.inExplanation = true;
      continue;
    }
    appendStem(current, line);
  }
  flush();

  const questions = drafts.map((draft, index) => {
    const raw = toRaw(draft);
    raw.row = index + 1;
    const question = normalizeQuestion(raw, file);
    if (question.stem.trim().length <= 10) {
      question.warnings.push("stem too short");
    }
    if (question.choices.length < 2) {
      if (!question.warnings.includes("fewer than 2 choices")) {
        question.warnings.push("fewer than 2 choices");
      }
    }
    if (!question.answer_key && !question.warnings.includes("answer key missing")) {
      question.warnings.push("answer key missing");
    }
    if (!question.explanation && !question.warnings.includes("explanation missing")) {
      question.warnings.push("explanation missing");
    }
    return question;
  });

  if (questions.length === 0) {
    warnings.push("No question markers found");
  }

  return { questions, warnings };
}

export function parseGrammarText(text: string, file = "") {
  const tokens = tokenize(text);
  const built = buildQuestions(tokens, file);
  return { ...built, tokens, pattern: GRAMMAR_PATTERN };
}

export function serializeToGrammar(question: GrammarQuestionInput, index = 1) {
  const lines = [`Q${index}. ${question.stem.trim()}`];
  for (const choice of question.choices) {
    if (!choice.text.trim()) continue;
    lines.push(`${choice.key}) ${choice.text.trim()}`);
  }
  if (question.standard_hint?.trim()) lines.push(`Standard: ${question.standard_hint.trim()}`);
  if (question.answer_key?.trim()) lines.push(`Answer: ${question.answer_key.trim().toUpperCase()}`);
  if (question.explanation?.trim()) lines.push(`Explanation: ${question.explanation.trim()}`);
  if (question.concept_hint?.trim()) lines.push(`Concept: ${question.concept_hint.trim()}`);
  if (question.difficulty_hint?.trim()) lines.push(`Difficulty: ${question.difficulty_hint.trim()}`);
  return lines.join("\n");
}

export function alignToGrammar(question: GrammarQuestionInput, file = "generated"): CanonicalQuestion | null {
  const serialized = serializeToGrammar(question, 1);
  const { questions } = buildQuestions(tokenize(serialized), file);
  return questions[0] ?? null;
}

export function canonicalToRaw(question: CanonicalQuestion): RawQuestion {
  return {
    stem: question.stem,
    choices: question.choices,
    answer_key: question.answer_key,
    explanation: question.explanation,
    standard_hint: question.standard_hint,
    concept_hint: question.concept_hint,
    difficulty_hint: question.difficulty_hint,
    slide_or_page: question.source.slide_or_page,
    row: question.source.row,
    raw_text: question.raw_text,
  };
}
