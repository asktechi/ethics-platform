import { cleanText, extractAnswerFromText, extractStandardHint } from "@/lib/importers/normalize";
import type { CanonicalChoice, RawQuestion } from "@/lib/importers/types";

const QUESTION_SPLIT = /(?=^(?:question\s+\d+\s*[:.)-]\s*|q\s*\d+\s*[:.)-]\s*|\d+\s*[.)]\s+))/im;
const CHOICE_LINE = /^\s*(?:\(?([A-Da-d])\)|([A-Da-d]))[.):]\s+(.+)$/;

export function parseChoiceLines(text: string): CanonicalChoice[] {
  const choices: CanonicalChoice[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(CHOICE_LINE);
    if (!match) continue;
    const rawKey = match[1] ?? match[2];
    const key = rawKey.toUpperCase();
    choices.push({ key, text: cleanText(match[3]) });
  }
  return choices;
}

export function hasChoicePrefixes(text: string) {
  return (text.match(/^\s*(?:\(?[A-Da-d]\)|[A-Da-d])[.):]\s+/gm) ?? []).length >= 2;
}

export function hasCorrectBlock(text: string) {
  return /\b[A-Da-d]\s+is\s+correct\b/i.test(text) || /^(?:answer|correct|explanation|rationale)\s*[:\-]/im.test(text);
}

export function parseOneProseBlock(chunk: string, row?: number, page?: number): RawQuestion | null {
  const lines = chunk.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
  const choiceIndexes: number[] = [];
  const choices: CanonicalChoice[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(CHOICE_LINE);
    if (!match) continue;
    choiceIndexes.push(index);
    const rawKey = match[1] ?? match[2];
    const key = rawKey.toUpperCase();
    choices.push({ key, text: cleanText(match[3]) });
  }
  const firstChoice = choiceIndexes[0] ?? lines.length;
  const stem = cleanText(lines.slice(0, firstChoice).join(" "));
  const after = lines.slice((choiceIndexes[choiceIndexes.length - 1] ?? firstChoice - 1) + 1);
  let answer_key: string | null = null;
  let explanation = "";
  for (const line of after) {
    const answer = line.match(/^(?:answer|correct(?:_answer)?|key)\s*[:\-]\s*(.+)$/i);
    const rationale = line.match(/^(?:explanation|rationale|why|reason|feedback)\s*[:\-]\s*(.+)$/i);
    if (answer) answer_key = extractAnswerFromText(answer[1], choices);
    else if (rationale) explanation = `${explanation} ${cleanText(rationale[1])}`.trim();
    else explanation = `${explanation} ${cleanText(line)}`.trim();
  }
  if (!answer_key) answer_key = extractAnswerFromText(explanation, choices);
  if (!stem) return null;
  return {
    stem,
    choices,
    answer_key,
    explanation: explanation || null,
    standard_hint: extractStandardHint(chunk),
    slide_or_page: page ?? null,
    row: row ?? null,
    raw_text: chunk,
  };
}

export function parseProseBlocks(text: string): RawQuestion[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const chunks = cleaned
    .split(QUESTION_SPLIT)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const questions: RawQuestion[] = [];
  chunks.forEach((chunk, index) => {
    const parsed = parseOneProseBlock(chunk, index + 1);
    if (parsed) questions.push(parsed);
  });
  return questions;
}
