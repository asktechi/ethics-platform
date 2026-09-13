import type { ParsedChoice, ParsedQuestion, ParseQuestionsResult } from "@/lib/parsers/questions/types";

const QUESTION_SPLIT = /(?=^(?:\d+[.)]\s+|Q\s*\d*[:.)]\s+))/im;
const CHOICE_LINE = /^\s*(?:\(?([A-Da-d])\)|[A-Da-d])[.):]\s+(.+)$/;
const STEM_PREFIX = /^(?:Q\s*\d*[:.)]\s*|\d+[.)]\s+)/i;

export function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
}

export function stripStemPrefix(stem: string) {
  return normalizeWhitespace(stem.replace(STEM_PREFIX, ""));
}

export function parseQuestionBlocks(text: string): ParseQuestionsResult {
  const warnings: string[] = [];
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return { questions: [], warnings: ["No question text found."] };

  const chunks = cleaned
    .split(QUESTION_SPLIT)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  let cursor = 1;
  for (const chunk of chunks) {
    const parsed = parseOneBlock(chunk, cursor);
    cursor += chunk.split("\n").length;
    if (!parsed.stem) {
      warnings.push(`Skipped a block with no stem near line ${parsed.source_line ?? "?"}.`);
      continue;
    }
    if (parsed.flagged) {
      warnings.push(`Question "${parsed.stem.slice(0, 48)}…" is missing an answer key.`);
    }
    if (parsed.choices.length > 0 && parsed.choices.length < 3) {
      warnings.push(
        `Question "${parsed.stem.slice(0, 48)}…" has ${parsed.choices.length} choices and was treated as open-ended.`,
      );
    }
    questions.push(parsed);
  }

  if (questions.length === 0) {
    warnings.push("No numbered questions or Q: markers were detected.");
  }
  return { questions, warnings };
}

export function parseOneBlock(chunk: string, sourceLine: number): ParsedQuestion {
  const lines = chunk.split("\n").map((line) => line.trimEnd());
  const choiceIndexes: number[] = [];
  const choices: ParsedChoice[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(CHOICE_LINE);
    if (!match) continue;
    choiceIndexes.push(index);
    choices.push({ key: match[1].toUpperCase(), text: normalizeWhitespace(match[2]) });
  }

  const firstChoice = choiceIndexes[0] ?? lines.length;
  const stem = stripStemPrefix(lines.slice(0, firstChoice).join(" "));
  const afterChoices = lines.slice((choiceIndexes[choiceIndexes.length - 1] ?? firstChoice - 1) + 1);

  let answer_key = "";
  let explanation = "";
  for (const line of afterChoices) {
    const answer = line.match(/^(?:answer|correct(?:_answer)?|key)\s*[:\-]\s*(.+)$/i);
    const rationale = line.match(/^(?:explanation|rationale|why)\s*[:\-]\s*(.+)$/i);
    if (answer) answer_key = normalizeAnswer(answer[1], choices);
    else if (rationale) explanation = normalizeWhitespace(rationale[1]);
    else if (!explanation) explanation = normalizeWhitespace(line);
    else explanation = `${explanation} ${normalizeWhitespace(line)}`;
  }

  const openEnded = choices.length > 0 && choices.length < 3;
  if (openEnded) {
    return {
      stem,
      choices: [],
      answer_key: answer_key || choices.map((choice) => choice.text).join(" "),
      explanation: explanation || undefined,
      source_line: sourceLine,
    };
  }

  const flagged = choices.length >= 3 && !answer_key;
  return {
    stem,
    choices,
    answer_key,
    explanation: explanation || undefined,
    source_line: sourceLine,
    flagged,
  };
}

export function normalizeAnswer(raw: string, choices: ParsedChoice[]) {
  const value = normalizeWhitespace(raw);
  const letter = value.match(/^([A-Da-d])\b/);
  if (letter) return letter[1].toUpperCase();
  const match = choices.find(
    (choice) => choice.text.toLowerCase() === value.toLowerCase() || value.toLowerCase().includes(choice.text.toLowerCase()),
  );
  return match?.key ?? value;
}
