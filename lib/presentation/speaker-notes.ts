import type { SlideAssignment } from "@/lib/presentation/types";

export type SpeakerNotes = {
  teleprompterText: string;
  wpmTarget: number;
  wordCount: number;
  estimatedSeconds: number;
  words: string[];
  lines: string[];
  revealLines: string[];
};

const DEFAULT_WPM = 130;
const LINE_WRAP = 80;

export function wordCountOf(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Split a script into reveal units: sentence boundaries, then ~80-char wraps. */
export function splitRevealLines(text: string): string[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const sentences: string[] = [];
  for (const block of blocks) {
    const parts = block.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length) sentences.push(...parts);
    else sentences.push(block);
  }

  const lines: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= LINE_WRAP) {
      lines.push(sentence);
      continue;
    }
    const words = sentence.split(/\s+/).filter(Boolean);
    let buffer = "";
    for (const word of words) {
      const next = buffer ? `${buffer} ${word}` : word;
      if (next.length > LINE_WRAP && buffer) {
        lines.push(buffer);
        buffer = word;
      } else {
        buffer = next;
      }
    }
    if (buffer) lines.push(buffer);
  }
  return lines;
}

export function lineIndexForWords(lines: string[], spokenWords: number) {
  if (lines.length === 0) return -1;
  let used = 0;
  for (let index = 0; index < lines.length; index += 1) {
    used += wordCountOf(lines[index]);
    if (spokenWords < used) return index;
  }
  return lines.length - 1;
}

export function revealIndexForSpoken(
  allLines: string[],
  revealLines: string[],
  spokenWords: number,
) {
  const current = lineIndexForWords(allLines, spokenWords);
  if (current < 0) return -1;
  const currentText = allLines[current];
  const direct = revealLines.indexOf(currentText);
  if (direct >= 0) return direct;
  return current - (allLines.length - revealLines.length);
}

export function deriveSpeakerNotes(
  slide: Pick<SlideAssignment, "title" | "body" | "cue" | "speakerNote"> | null | undefined,
  wpmTarget = DEFAULT_WPM,
): SpeakerNotes {
  const wpm = wpmTarget > 0 ? wpmTarget : DEFAULT_WPM;
  if (!slide) {
    return {
      teleprompterText: "",
      wpmTarget: wpm,
      wordCount: 0,
      estimatedSeconds: 0,
      words: [],
      lines: [],
      revealLines: [],
    };
  }

  const teleprompterText = [slide.title, slide.body, slide.cue, slide.speakerNote]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const revealSource = [slide.body, slide.speakerNote]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const words = teleprompterText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lines = splitRevealLines(teleprompterText);
  const revealLines = splitRevealLines(revealSource);

  return {
    teleprompterText,
    wpmTarget: wpm,
    wordCount,
    estimatedSeconds: wordCount / (wpm / 60),
    words,
    lines,
    revealLines,
  };
}
