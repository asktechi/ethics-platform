import JSZip from "jszip";
import { normalizeAnswer, normalizeWhitespace, stripStemPrefix } from "@/lib/parsers/questions/text";
import type { ParsedChoice, ParsedQuestion, ParseQuestionsResult } from "@/lib/parsers/questions/types";

function extractTextRuns(xml: string): string[] {
  const runs: string[] = [];
  const pattern = /<a:t(?![a-zA-Z])[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (text) runs.push(text);
  }
  return runs;
}

export async function parseQuestionsPptx(
  buffer: Buffer,
  filename: string,
): Promise<ParseQuestionsResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  for (const [index, name] of slideNames.entries()) {
    const xml = await zip.files[name].async("string");
    const runs = extractTextRuns(xml);
    const stem = stripStemPrefix(runs[0] ?? "");
    const choices: ParsedChoice[] = runs.slice(1).map((run, optionIndex) => ({
      key: String.fromCharCode(65 + optionIndex),
      text: normalizeWhitespace(run.replace(/^[A-Da-d][.)]\s*/, "")),
    })).filter((choice) => choice.text);

    const noteName = name.replace("ppt/slides/slide", "ppt/notesSlides/notesSlide");
    const notesFile = zip.files[noteName] ?? zip.files[name.replace("/slides/", "/notesSlides/notes")];
    let notes = "";
    if (notesFile) notes = extractTextRuns(await notesFile.async("string")).join("\n");

    let answer_key = "";
    let explanation = "";
    const answerLine = notes.match(/(?:answer|correct)\s*[:\-]\s*(.+)/i);
    const whyLine = notes.match(/(?:explanation|rationale)\s*[:\-]\s*(.+)/i);
    if (answerLine) answer_key = normalizeAnswer(answerLine[1], choices);
    if (whyLine) explanation = normalizeWhitespace(whyLine[1]);
    else if (notes && !answer_key) {
      const parts = notes.split(/\n+/);
      answer_key = normalizeAnswer(parts[0] ?? "", choices);
      explanation = normalizeWhitespace(parts.slice(1).join(" "));
    }

    if (!stem) {
      warnings.push(`${filename} slide ${index + 1}: empty title/stem.`);
      continue;
    }
    if (choices.length > 0 && choices.length < 3) {
      warnings.push(`${filename} slide ${index + 1}: ${choices.length} bullets — treated as open-ended.`);
      questions.push({
        stem,
        choices: [],
        answer_key: answer_key || choices.map((choice) => choice.text).join(" "),
        explanation: explanation || undefined,
        source_line: index + 1,
      });
      continue;
    }
    const flagged = choices.length >= 3 && !answer_key;
    if (flagged) warnings.push(`${filename} slide ${index + 1}: answer not found in notes.`);
    questions.push({
      stem,
      choices,
      answer_key,
      explanation: explanation || undefined,
      source_line: index + 1,
      flagged,
    });
  }

  if (questions.length === 0) {
    warnings.push(`${filename}: no slides produced a question.`);
  }
  return { questions, warnings };
}
