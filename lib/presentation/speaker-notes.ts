import type { SlideAssignment } from "@/lib/presentation/types";

export type SpeakerNotes = {
  teleprompterText: string;
  wpmTarget: number;
  wordCount: number;
  estimatedSeconds: number;
  words: string[];
};

const DEFAULT_WPM = 130;

export function wordCountOf(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
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
    };
  }

  const teleprompterText = [slide.title, slide.body, slide.cue, slide.speakerNote]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const words = teleprompterText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  return {
    teleprompterText,
    wpmTarget: wpm,
    wordCount,
    estimatedSeconds: wordCount / (wpm / 60),
    words,
  };
}
