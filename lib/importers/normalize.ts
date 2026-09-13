import { nanoid } from "nanoid";
import type { CanonicalChoice, CanonicalQuestion, DifficultyHint, RawQuestion } from "@/lib/importers/types";

const CURLY: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
};

export function cleanText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014]/g, (char) => CURLY[char] ?? char)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

export function stripStemPrefix(stem: string) {
  return cleanText(stem)
    .replace(/^(?:question\s+\d+\s*[:.)-]\s*|q\s*\d+\s*[:.)-]\s*|\d+\s*[.)]\s+)/i, "")
    .replace(/^(?:page\s+\d+|\d+|-\s*\d+\s*-)\s*$/i, "")
    .trim();
}

export function stripPageArtifacts(stem: string) {
  return cleanText(stem)
    .replace(/\s*(?:page\s+\d+|-\s*\d+\s*-)\s*$/i, "")
    .replace(/^\s*(?:page\s+\d+)\s*/i, "")
    .trim();
}

export function normalizeChoiceKey(raw: string, index: number) {
  const value = cleanText(raw);
  const option = value.match(/(?:option|choice|answer|opt)?\s*([A-Da-d])\b/);
  if (option) return option[1].toUpperCase();
  const numbered = value.match(/^([1-4])\b/);
  if (numbered) return String.fromCharCode(64 + Number(numbered[1]));
  if (/^[A-D]$/i.test(value)) return value.toUpperCase();
  return String.fromCharCode(65 + index);
}

export function extractAnswerFromText(text: string, choices: CanonicalChoice[]) {
  const cleaned = cleanText(text);
  const letter = cleaned.match(/\b([A-Da-d])\s+is\s+correct\b/i)
    ?? cleaned.match(/^(?:answer|correct(?:_answer)?|key)\s*[:\-]\s*([A-Da-d])\b/i)
    ?? cleaned.match(/\bcorrect\s+(?:choice|option|answer)\s+is\s+([A-Da-d])\b/i)
    ?? cleaned.match(/^([A-Da-d])\b/);
  if (letter) return letter[1].toUpperCase();
  const marked = choices.find((choice) => /\*(?:\s|$)|\(correct\)/i.test(choice.text));
  if (marked) return marked.key;
  const match = choices.find(
    (choice) =>
      choice.text &&
      (cleaned.toLowerCase() === choice.text.toLowerCase() ||
        cleaned.toLowerCase().includes(choice.text.toLowerCase())),
  );
  return match?.key ?? null;
}

export function extractStandardHint(text: string) {
  const match = text.match(/\bStandard\s+([IVX]+(?:\s*\([A-Z]\))?)/i);
  return match ? `Standard ${match[1].replace(/\s+/g, "")}` : null;
}

export function normalizeDifficulty(value: string | null | undefined): DifficultyHint | null {
  const raw = cleanText(value ?? "").toLowerCase();
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return null;
}

function stripChoiceMarks(text: string) {
  return cleanText(text.replace(/\s*\*(?:\s|$)/, " ").replace(/\s*\(correct\)\s*/i, " "));
}

export function normalizeQuestion(raw: RawQuestion, file: string): CanonicalQuestion {
  const warnings: string[] = [];
  const stem = stripPageArtifacts(stripStemPrefix(raw.stem));
  const choices = raw.choices
    .map((choice, index) => ({
      key: normalizeChoiceKey(choice.key || String(index + 1), index),
      text: stripChoiceMarks(choice.text.replace(/^[A-Da-d1-4][.):]\s*/, "")),
    }))
    .filter((choice) => choice.text);

  const keys = choices.map((choice) => choice.key);
  if (new Set(keys).size !== keys.length) warnings.push("duplicate choice keys");

  let answer = raw.answer_key ? normalizeChoiceKey(raw.answer_key, 0) : null;
  if (!answer || !/^[A-D]$/.test(answer)) {
    answer = extractAnswerFromText(raw.answer_key ?? "", choices);
  }
  if (!answer) {
    answer = extractAnswerFromText(raw.explanation ?? "", choices);
  }
  if (!answer) {
    for (const choice of raw.choices) {
      if (/\*|(\(correct\))/i.test(choice.text)) {
        answer = normalizeChoiceKey(choice.key, 0);
        break;
      }
    }
  }
  if (answer && !choices.some((choice) => choice.key === answer)) {
    const mapped = extractAnswerFromText(raw.answer_key ?? raw.explanation ?? "", choices);
    answer = mapped;
  }
  if (!answer) warnings.push("answer key missing");

  const explanation = cleanText(raw.explanation ?? "") || null;
  if (!explanation || explanation.length < 40) warnings.push("explanation weak");
  if (stem.length < 50) warnings.push("stem too short");
  if (stem.length > 3000) warnings.push("stem too long");
  if (choices.length < 2) warnings.push("fewer than 2 choices");

  return {
    id: nanoid(10),
    stem,
    choices,
    answer_key: answer,
    explanation,
    standard_hint: raw.standard_hint ?? extractStandardHint(`${raw.stem}\n${raw.explanation ?? ""}\n${raw.raw_text}`),
    concept_hint: raw.concept_hint ? cleanText(raw.concept_hint) : null,
    difficulty_hint: raw.difficulty_hint ?? null,
    warnings,
    source: {
      file,
      slide_or_page: raw.slide_or_page ?? null,
      row: raw.row ?? null,
    },
    raw_text: raw.raw_text,
  };
}

export function pickBestStrategy<T extends { questions: RawQuestion[] }>(results: T[]) {
  let best = results[0];
  let bestScore = -1;
  for (const result of results) {
    const score = result.questions.reduce(
      (sum, question) => sum + validLocal(question),
      0,
    );
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }
  return best;
}

function validLocal(question: RawQuestion) {
  if (stripStemPrefix(question.stem).length < 20) return 0;
  if (question.choices.length < 2) return 0;
  return question.answer_key ? 3 : 2;
}
