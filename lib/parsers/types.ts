export type ParsedSlide = {
  order: number;
  title: string;
  body: string;
  cue: string;
  speaker_note: string;
};

export type ParseResult = {
  slides: ParsedSlide[];
  metadata: {
    warnings: string[];
    [key: string]: unknown;
  };
};

export class UnsupportedFormatError extends Error {
  readonly code = "UNSUPPORTED_FORMAT";

  constructor(filename: string, mime?: string) {
    super(`Unsupported format for ${filename}${mime ? ` (${mime})` : ""}.`);
    this.name = "UnsupportedFormatError";
  }
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function firstLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

export function restAfterFirstLine(text: string): string {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim());
  if (index < 0) return "";
  return lines.slice(index + 1).join("\n").trim();
}

export function normalizeSlides(slides: ParsedSlide[]): ParsedSlide[] {
  return slides
    .filter((slide) => slide.title.trim() || slide.body.trim())
    .map((slide, index) => ({
      ...slide,
      order: index + 1,
      title: slide.title.trim() || `Slide ${index + 1}`,
      body: slide.body.trim(),
      cue: slide.cue.trim(),
      speaker_note: slide.speaker_note.trim(),
    }));
}

export function collapseIfNeeded(
  slides: ParsedSlide[],
  warnings: string[],
): ParsedSlide[] {
  if (slides.length <= 40) {
    return normalizeSlides(slides);
  }

  warnings.push(
    `Parser produced ${slides.length} slides; collapsing under nearest headings so each stays under 120 words.`,
  );

  const collapsed: ParsedSlide[] = [];
  let current: ParsedSlide | null = null;

  const flush = () => {
    if (current) collapsed.push(current);
    current = null;
  };

  for (const slide of slides) {
    const heading = slide.title.trim();
    const incoming = [slide.body, slide.cue, slide.speaker_note].filter(Boolean).join("\n\n");

    if (!current || heading) {
      flush();
      current = {
        order: collapsed.length + 1,
        title: heading || slide.title,
        body: incoming,
        cue: "",
        speaker_note: "",
      };
      continue;
    }

    const nextBody = current.body ? `${current.body}\n\n${incoming}` : incoming;
    if (wordCount(nextBody) > 120) {
      flush();
      current = {
        order: collapsed.length + 1,
        title: current.title,
        body: incoming,
        cue: "",
        speaker_note: "",
      };
    } else {
      current.body = nextBody;
    }
  }
  flush();

  return normalizeSlides(collapsed);
}
