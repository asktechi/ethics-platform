import { cleanText, extractAnswerFromText, normalizeChoiceKey, normalizeDifficulty } from "@/lib/importers/normalize";
import type { CanonicalChoice, RawQuestion } from "@/lib/importers/types";

const STEM_ALIASES = ["stem", "question", "q", "prompt", "text"];
const ANSWER_ALIASES = ["answer", "correct", "key", "correct_answer", "correct_option", "answer_key"];
const EXPLAIN_ALIASES = ["explanation", "rationale", "reason", "feedback", "why"];
const STANDARD_ALIASES = ["standard", "code", "std", "standard_code"];
const CONCEPT_ALIASES = ["concept", "topic"];
const DIFFICULTY_ALIASES = ["difficulty", "level", "complexity"];
const CHOICE_GROUPS = [
  ["a", "choice_a", "option_a", "optiona", "opta", "answer_a", "1"],
  ["b", "choice_b", "option_b", "optionb", "optb", "answer_b", "2"],
  ["c", "choice_c", "option_c", "optionc", "optc", "answer_c", "3"],
  ["d", "choice_d", "option_d", "optiond", "optd", "answer_d", "4"],
];

function normHeader(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pick(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const found = Object.keys(row).find((key) => normHeader(key) === alias);
    if (found && cleanText(row[found])) return cleanText(row[found]);
  }
  return "";
}

function looksLikeHeader(values: string[]) {
  const joined = values.map(normHeader).join(" ");
  return STEM_ALIASES.some((alias) => joined.includes(alias)) || joined.includes("choice") || joined.includes("answer");
}

export function rowsToQuestions(
  rows: string[][],
  filename: string,
): { questions: RawQuestion[]; warnings: string[]; usedHeaders: boolean } {
  if (rows.length === 0) return { questions: [], warnings: [`${filename}: empty table`], usedHeaders: false };
  const header = rows[0].map((cell) => cleanText(cell));
  const usedHeaders = looksLikeHeader(header);
  const warnings: string[] = [];
  const questions: RawQuestion[] = [];

  const body = usedHeaders ? rows.slice(1) : rows;
  if (!usedHeaders) {
    warnings.push(`${filename}: headers did not match known aliases; used positional columns (stem, A, B, C, D, answer, explanation).`);
  }

  body.forEach((cells, index) => {
    const record: Record<string, string> = {};
    if (usedHeaders) {
      header.forEach((key, col) => {
        record[key] = cells[col] ?? "";
      });
    }
    const stem = usedHeaders
      ? pick(record, STEM_ALIASES)
      : cleanText(cells[0] ?? "");
    if (!stem) return;
    const choices: CanonicalChoice[] = [];
    if (usedHeaders) {
      CHOICE_GROUPS.forEach((aliases, optionIndex) => {
        const text = pick(record, aliases);
        if (text) choices.push({ key: String.fromCharCode(65 + optionIndex), text });
      });
    } else {
      cells.slice(1, 5).forEach((cell, optionIndex) => {
        const text = cleanText(cell ?? "");
        if (text) choices.push({ key: String.fromCharCode(65 + optionIndex), text });
      });
    }
    const answerRaw = usedHeaders ? pick(record, ANSWER_ALIASES) : cleanText(cells[5] ?? "");
    const explanation = usedHeaders ? pick(record, EXPLAIN_ALIASES) : cleanText(cells[6] ?? "");
    questions.push({
      stem,
      choices,
      answer_key: answerRaw ? normalizeChoiceKey(answerRaw, 0) : extractAnswerFromText(explanation, choices),
      explanation: explanation || null,
      standard_hint: usedHeaders ? pick(record, STANDARD_ALIASES) || null : null,
      concept_hint: usedHeaders ? pick(record, CONCEPT_ALIASES) || null : null,
      difficulty_hint: usedHeaders ? normalizeDifficulty(pick(record, DIFFICULTY_ALIASES)) : null,
      row: (usedHeaders ? index + 2 : index + 1),
      raw_text: cells.join(" | "),
    });
  });

  return { questions, warnings, usedHeaders };
}
