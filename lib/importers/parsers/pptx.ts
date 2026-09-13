import JSZip from "jszip";
import { extractAnswerFromText, extractStandardHint, pickBestStrategy } from "@/lib/importers/normalize";
import { hasChoicePrefixes, hasCorrectBlock, parseChoiceLines, parseOneProseBlock, parseProseBlocks } from "@/lib/importers/prose";
import { rowsToQuestions } from "@/lib/importers/tabular";
import { extractDrawingText } from "@/lib/importers/xml";
import type { RawQuestion, StrategyResult } from "@/lib/importers/types";

type Slide = {
  index: number;
  runs: string[];
  text: string;
  notes: string;
  xml: string;
};

function slideNumber(name: string) {
  return Number(/slide(\d+)\.xml$/i.exec(name)?.[1] ?? 0);
}

async function loadSlides(buffer: Buffer): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides: Slide[] = [];
  for (const name of names) {
    const xml = await zip.files[name].async("string");
    const runs = extractDrawingText(xml);
    const noteName = name.replace(/ppt\/slides\/slide(\d+)\.xml$/i, "ppt/notesSlides/notesSlide$1.xml");
    const notesFile = zip.files[noteName];
    const notes = notesFile ? extractDrawingText(await notesFile.async("string")).join("\n") : "";
    slides.push({
      index: slideNumber(name),
      runs,
      text: runs.join("\n"),
      notes,
      xml,
    });
  }
  return slides;
}

function tablesFromSlide(xml: string, filename: string, slide: number): RawQuestion[] {
  const tables = xml.split(/<a:tbl[\s>]/).slice(1);
  const questions: RawQuestion[] = [];
  for (const table of tables) {
    const rows = table.split(/<a:tr[\s>]/).slice(1).map((row) => {
      const cells = row.split(/<a:tc[\s>]/).slice(1).map((cell) => extractDrawingText(cell).join(" ").trim());
      return cells;
    }).filter((row) => row.some(Boolean));
    if (rows.length === 0) continue;
    const mapped = rowsToQuestions(rows, filename);
    mapped.questions.forEach((question) => {
      questions.push({ ...question, slide_or_page: slide });
    });
  }
  return questions;
}

function onePerSlide(slides: Slide[]): RawQuestion[] {
  return slides
    .filter((slide) => {
      const first = slide.runs[0] ?? "";
      if (hasChoicePrefixes(slide.text) && /^\s*(?:\(?[A-Da-d1-4]\)|[A-Da-d1-4])[.):]/.test(first)) {
        return false;
      }
      if (hasCorrectBlock(slide.text) && !hasChoicePrefixes(slide.text) && slide.text.replace(/\s+/g, " ").length < 200) {
        return false;
      }
      return true;
    })
    .map((slide) => {
      const stem = slide.runs[0] ?? "";
      const choiceRuns = slide.runs.slice(1);
      const fromPrefix = parseChoiceLines(choiceRuns.join("\n"));
      const choices = fromPrefix.length
        ? fromPrefix
        : choiceRuns
            .filter((run) => run.trim())
            .map((run, index) => ({
              key: String.fromCharCode(65 + index),
              text: run.replace(/^[A-Da-d1-4][.):]\s*/, "").trim(),
            }));
      const combined = `${slide.notes}\n${slide.text}`;
      return {
        stem,
        choices,
        answer_key: extractAnswerFromText(slide.notes, choices) ?? extractAnswerFromText(combined, choices),
        explanation: slide.notes || (hasCorrectBlock(slide.text) ? slide.text : null),
        standard_hint: extractStandardHint(combined),
        slide_or_page: slide.index,
        raw_text: `${slide.text}\n${slide.notes}`,
      } satisfies RawQuestion;
    })
    .filter((question) => question.stem.trim().length >= 20);
}

function vignetteSpread(slides: Slide[]): RawQuestion[] {
  const questions: RawQuestion[] = [];
  let index = 0;
  while (index < slides.length) {
    const slide = slides[index];
    const isProse = slide.text.replace(/\s+/g, " ").length > 100 && !hasChoicePrefixes(slide.text) && !hasCorrectBlock(slide.text);
    if (!isProse) {
      index += 1;
      continue;
    }
    let stem = slide.text;
    let cursor = index + 1;
    const choiceSlides: Slide[] = [];
    while (cursor < slides.length && hasChoicePrefixes(slides[cursor].text)) {
      choiceSlides.push(slides[cursor]);
      cursor += 1;
    }
    const follow: Slide[] = [];
    while (
      cursor < slides.length &&
      (hasCorrectBlock(slides[cursor].text) || extractStandardHint(slides[cursor].text)) &&
      !hasChoicePrefixes(slides[cursor].text)
    ) {
      const nextIsProse =
        slides[cursor].text.replace(/\s+/g, " ").length > 100 &&
        !hasCorrectBlock(slides[cursor].text) &&
        !extractStandardHint(slides[cursor].text);
      if (nextIsProse) break;
      follow.push(slides[cursor]);
      cursor += 1;
    }
    const choiceText = choiceSlides.map((item) => item.text).join("\n");
    const followText = follow.map((item) => item.text).join("\n");
    const choices = parseChoiceLines(choiceText);
    if (choices.length >= 2) {
      questions.push({
        stem,
        choices,
        answer_key: extractAnswerFromText(followText, choices),
        explanation: followText || null,
        standard_hint: extractStandardHint(followText),
        slide_or_page: slide.index,
        raw_text: [stem, choiceText, followText].join("\n\n"),
      });
      index = cursor;
      continue;
    }
    index += 1;
  }
  return questions;
}

function numberedOnSlides(slides: Slide[]): RawQuestion[] {
  return slides.flatMap((slide) =>
    parseProseBlocks(slide.text).map((question) => ({
      ...question,
      slide_or_page: slide.index,
    })),
  );
}

export async function parsePptx(buffer: Buffer, filename: string): Promise<StrategyResult> {
  const slides = await loadSlides(buffer);
  const tableQuestions = slides.flatMap((slide) => tablesFromSlide(slide.xml, filename, slide.index));
  const one = onePerSlide(slides);
  const vignette = vignetteSpread(slides);
  const numbered = numberedOnSlides(slides);

  const best = pickBestStrategy([
    { questions: tableQuestions },
    { questions: one },
    { questions: vignette },
    { questions: numbered },
  ]);

  let pattern = "one-per-slide";
  if (best.questions === tableQuestions && tableQuestions.length) pattern = "table";
  else if (best.questions === vignette && vignette.length) pattern = "vignette";
  else if (best.questions === numbered && numbered.length) pattern = "numbered-prose";

  return {
    pattern,
    questions: best.questions,
    warnings: best.questions.length === 0 ? [`${filename}: no PPTX strategy produced questions`] : [],
  };
}
