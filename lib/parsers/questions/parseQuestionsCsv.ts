import Papa from "papaparse";
import {
  normalizeAnswer,
  normalizeWhitespace,
  stripStemPrefix,
} from "@/lib/parsers/questions/text";
import type { ParsedChoice, ParsedQuestion, ParseQuestionsResult } from "@/lib/parsers/questions/types";

const STEM_KEYS = ["stem", "question", "q", "prompt"];
const ANSWER_KEYS = ["answer", "correct_answer", "correct", "answer_key", "key"];
const EXPLAIN_KEYS = ["explanation", "rationale", "why"];
const CHOICE_KEYS = [
  ["choice_a", "a", "option_a", "options_a"],
  ["choice_b", "b", "option_b", "options_b"],
  ["choice_c", "c", "option_c", "options_c"],
  ["choice_d", "d", "option_d", "options_d"],
  ["choice_e", "e", "option_e"],
];

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find((field) => field.trim().toLowerCase() === key);
    if (found && String(row[found] ?? "").trim()) return String(row[found]);
  }
  return "";
}

export function parseQuestionsCsv(buffer: Buffer, filename: string): ParseQuestionsResult {
  const warnings: string[] = [];
  const parsed = Papa.parse<Record<string, string>>(buffer.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    warnings.push(
      `${filename}: ${parsed.errors.slice(0, 4).map((error) => error.message).join("; ")}`,
    );
  }

  const questions: ParsedQuestion[] = [];
  parsed.data.forEach((row, index) => {
    const stem = stripStemPrefix(pick(row, STEM_KEYS));
    if (!stem) {
      warnings.push(`${filename} row ${index + 2}: empty stem — kept the row in warnings, not dropped silently.`);
      return;
    }
    const optionsBlob = pick(row, ["options", "choices"]);
    const choices: ParsedChoice[] = [];
    if (optionsBlob) {
      optionsBlob.split(/\s*\|\s*|\s*;\s*|\n/).forEach((part, optionIndex) => {
        const text = normalizeWhitespace(part.replace(/^[A-Da-d][.)]\s*/, ""));
        if (text) choices.push({ key: String.fromCharCode(65 + optionIndex), text });
      });
    } else {
      CHOICE_KEYS.forEach((keys, optionIndex) => {
        const text = normalizeWhitespace(pick(row, keys));
        if (text) choices.push({ key: String.fromCharCode(65 + optionIndex), text });
      });
    }

    let answer_key = normalizeAnswer(pick(row, ANSWER_KEYS), choices);
    const explanation = normalizeWhitespace(pick(row, EXPLAIN_KEYS)) || undefined;
    if (choices.length > 0 && choices.length < 3) {
      warnings.push(`${filename} row ${index + 2}: ${choices.length} choices — treated as open-ended.`);
      answer_key = answer_key || choices.map((choice) => choice.text).join(" ");
      questions.push({
        stem,
        choices: [],
        answer_key,
        explanation,
        source_line: index + 2,
      });
      return;
    }
    const flagged = choices.length >= 3 && !answer_key;
    if (flagged) warnings.push(`${filename} row ${index + 2}: answer_key missing.`);
    questions.push({
      stem,
      choices,
      answer_key,
      explanation,
      source_line: index + 2,
      flagged,
    });
  });

  return { questions, warnings };
}
