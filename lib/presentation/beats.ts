import { splitContrastBody } from "@/lib/presentation/format";
import { deriveSpeakerNotes, splitRevealLines } from "@/lib/presentation/speaker-notes";
import type { SlideAssignment, SlideLayout } from "@/lib/presentation/types";

/** Shared 16:9 stage so host center and audience paginate identically. */
export const CANONICAL_VIEWPORT = { width: 1920, height: 1080 } as const;

export const FONT_STEPS = [96, 84, 72, 60, 48, 40, 34] as const;
export const MIN_FONT_SIZE = 34;
export const HEADLINE_FONT_SIZE = 96;
export const BODY_HEAVY_FONT_SIZE = 72;

export type Beat = {
  startLineIndex: number;
  endLineIndex: number;
  lines: string[];
  leftLines?: string[];
  rightLines?: string[];
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PaginateSlideInput = {
  slide: { id: string; title?: string; body?: string };
  lines: string[];
  viewport: ViewportSize;
  layout: SlideLayout;
};

export type PaginationResult = {
  beats: Beat[];
  fontSize: number;
  lineHeight: number;
  maxLineChars: number;
  safeArea: SafeArea;
};

export type SafeArea = {
  horizontal: number;
  vertical: number;
  width: number;
  height: number;
};

const cache = new Map<string, PaginationResult>();

export function horizontalMargin(width: number) {
  return clamp(width * 0.1, 60, 160);
}

export function verticalMargin(height: number) {
  return clamp(height * 0.12, 80, 200);
}

export function computeSafeArea(viewport: ViewportSize): SafeArea {
  const horizontal = horizontalMargin(viewport.width);
  const vertical = verticalMargin(viewport.height);
  return {
    horizontal,
    vertical,
    width: Math.max(120, viewport.width - horizontal * 2),
    height: Math.max(120, viewport.height - vertical * 2),
  };
}

export function startingFontSize(layout: SlideLayout) {
  if (layout === "scenario" || layout === "reveal" || layout === "contrast") {
    return BODY_HEAVY_FONT_SIZE;
  }
  return HEADLINE_FONT_SIZE;
}

export function recommendedLineHeight(layout: SlideLayout) {
  if (layout === "hook" || layout === "point" || layout === "question") return 1.2;
  return 1.5;
}

export function beatIndexForLine(beats: Beat[], lineIndex: number) {
  if (beats.length === 0) return 0;
  if (lineIndex < 0) return 0;
  const found = beats.findIndex(
    (beat) => lineIndex >= beat.startLineIndex && lineIndex <= beat.endLineIndex,
  );
  if (found >= 0) return found;
  if (lineIndex > beats[beats.length - 1].endLineIndex) return beats.length - 1;
  return 0;
}

export function paginateAssignment(
  slide: Pick<SlideAssignment, "slideId" | "title" | "body" | "cue" | "speakerNote" | "layout">,
  viewport: ViewportSize = CANONICAL_VIEWPORT,
) {
  const lines = deriveSpeakerNotes(slide).revealLines;
  return paginateSlide({
    slide: { id: slide.slideId, title: slide.title, body: slide.body },
    lines,
    viewport,
    layout: slide.layout,
  });
}

export function paginateSlide(input: PaginateSlideInput): PaginationResult {
  const { slide, lines, viewport, layout } = input;
  const key = `${slide.id}:${Math.round(viewport.width)}x${Math.round(viewport.height)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const safe = computeSafeArea(viewport);
  const title = (slide.title ?? "").trim();
  const start = startingFontSize(layout);
  const steps = FONT_STEPS.filter((size) => size <= start);
  const lineHeight = recommendedLineHeight(layout);

  let fontSize = start;
  if (layout === "cue") {
    fontSize = HEADLINE_FONT_SIZE;
  } else if (layout === "hook") {
    fontSize = pickFontSize({
      title,
      lines,
      layout,
      safe,
      steps: steps.filter((size) => size >= 48),
      preferSingleBeat: true,
    });
    const hookFits = contentFits({
      title,
      lines,
      layout,
      fontSize,
      safe,
    });
    if (!hookFits) {
      fontSize = pickFontSize({ title, lines, layout, safe, steps, preferSingleBeat: false });
    }
  } else {
    fontSize = pickFontSize({ title, lines, layout, safe, steps, preferSingleBeat: false });
  }

  const maxLineChars = recommendedWrapChars(safe.width, fontSize);
  const beats =
    layout === "cue"
      ? [makeBeat(0, Math.max(0, lines.length - 1), lines)]
      : layout === "contrast"
        ? packContrastBeats({
            body: slide.body ?? "",
            sourceLines: lines,
            title,
            layout,
            fontSize,
            safe,
          })
        : packBeats({
            lines,
            title,
            layout,
            fontSize,
            safe,
          });

  const result: PaginationResult = {
    beats: beats.length ? beats : [makeBeat(0, Math.max(0, lines.length - 1), lines)],
    fontSize,
    lineHeight,
    maxLineChars,
    safeArea: safe,
  };
  cache.set(key, result);
  return result;
}

export function clearPaginationCache() {
  cache.clear();
}

function pickFontSize(options: {
  title: string;
  lines: string[];
  layout: SlideLayout;
  safe: SafeArea;
  steps: readonly number[];
  preferSingleBeat: boolean;
}) {
  const { title, lines, layout, safe, steps } = options;
  if (!title && lines.length === 0) return HEADLINE_FONT_SIZE;

  const start = steps[0] ?? HEADLINE_FONT_SIZE;
  const startHeight = measureBlock({ title, lines, layout, fontSize: start }).height;
  const fill = startHeight / safe.height;
  if (fill <= 0.7 && contentFits({ title, lines, layout, fontSize: start, safe })) {
    return start;
  }

  for (const fontSize of steps) {
    if (contentFits({ title, lines, layout, fontSize, safe })) return fontSize;
  }
  return steps[steps.length - 1] ?? MIN_FONT_SIZE;
}

function contentFits(options: {
  title: string;
  lines: string[];
  layout: SlideLayout;
  fontSize: number;
  safe: SafeArea;
}) {
  const measured = measureBlock(options);
  const lookahead = bodyLineHeight(options.fontSize);
  return measured.height + lookahead <= options.safe.height && measured.width <= options.safe.width;
}

function measureBlock(options: {
  title: string;
  lines: string[];
  layout: SlideLayout;
  fontSize: number;
}) {
  const { title, lines, layout, fontSize } = options;
  const titleH = title ? fontSize * 1.2 : 0;
  const gap = title && lines.length ? fontSize * 0.4 : 0;
  const extra = layoutExtra(layout, fontSize);
  const bodyH = lines.length * bodyLineHeight(fontSize);
  const titleW = title ? title.length * fontSize * 0.62 : 0;
  const bodyW = lines.reduce((max, line) => Math.max(max, line.length * fontSize * 0.72 * 0.55), 0);
  return {
    height: titleH + gap + extra + bodyH,
    width: Math.max(titleW, bodyW),
  };
}

function layoutExtra(layout: SlideLayout, fontSize: number) {
  if (layout === "question") return fontSize * 1.15;
  if (layout === "scenario") return 72;
  if (layout === "contrast") return 16;
  return 0;
}

function bodyLineHeight(fontSize: number) {
  return fontSize * 0.72 * 1.5;
}

function packBeats(options: {
  lines: string[];
  title: string;
  layout: SlideLayout;
  fontSize: number;
  safe: SafeArea;
}): Beat[] {
  const { lines, title, layout, fontSize, safe } = options;
  if (lines.length === 0) return [makeBeat(0, 0, [])];

  const capacity = lineCapacity({ title, layout, fontSize, safe });
  const beats: Beat[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const remaining = lines.length - cursor;
    let take = Math.min(capacity, remaining);
    if (take <= 0) take = 1;
    if (take === 1 && remaining > 1 && capacity >= 2) take = 2;
    if (remaining === 1) take = 1;
    const chunk = lines.slice(cursor, cursor + take);
    beats.push(makeBeat(cursor, cursor + take - 1, chunk));
    cursor += take;
  }
  return beats;
}

function packContrastBeats(options: {
  body: string;
  sourceLines: string[];
  title: string;
  layout: SlideLayout;
  fontSize: number;
  safe: SafeArea;
}): Beat[] {
  const { body, sourceLines, title, layout, fontSize, safe } = options;
  const [leftText, rightText] = splitContrastBody(body);
  const leftLines = splitRevealLines(leftText);
  const rightLines = splitRevealLines(rightText);
  if (leftLines.length === 0 && rightLines.length === 0) {
    return packBeats({ lines: sourceLines, title, layout, fontSize, safe });
  }

  const columnSafe: SafeArea = {
    ...safe,
    width: Math.max(80, (safe.width - 48) / 2),
  };
  const leftBeats = packBeats({
    lines: leftLines,
    title,
    layout,
    fontSize,
    safe: { ...columnSafe, height: safe.height },
  });
  const rightBeats = packBeats({
    lines: rightLines,
    title,
    layout,
    fontSize,
    safe: { ...columnSafe, height: safe.height },
  });

  const count = Math.max(leftBeats.length, rightBeats.length, 1);
  const beats: Beat[] = [];
  let leftSearch = 0;
  let rightSearch = 0;
  for (let index = 0; index < count; index += 1) {
    const left = leftBeats[index] ?? makeBeat(0, 0, []);
    const right = rightBeats[index] ?? makeBeat(0, 0, []);
    const leftIdx = mapColumnToSource(sourceLines, left.lines, leftSearch);
    const rightIdx = mapColumnToSource(sourceLines, right.lines, rightSearch);
    if (leftIdx.length) leftSearch = leftIdx[leftIdx.length - 1] + 1;
    if (rightIdx.length) rightSearch = rightIdx[rightIdx.length - 1] + 1;
    const mapped = [...leftIdx, ...rightIdx].sort((a, b) => a - b);
    const startLineIndex = mapped[0] ?? 0;
    const endLineIndex = mapped[mapped.length - 1] ?? Math.max(0, sourceLines.length - 1);
    beats.push({
      startLineIndex,
      endLineIndex,
      lines: sourceLines.slice(startLineIndex, endLineIndex + 1),
      leftLines: left.lines,
      rightLines: right.lines,
    });
  }
  return beats;
}

function mapColumnToSource(source: string[], column: string[], from: number) {
  const indexes: number[] = [];
  let search = from;
  for (const line of column) {
    let found = source.indexOf(line, search);
    if (found < 0) {
      found = source.findIndex(
        (candidate, index) =>
          index >= search && (candidate.includes(line) || line.includes(candidate)),
      );
    }
    if (found >= 0) {
      indexes.push(found);
      search = found + 1;
    }
  }
  return indexes;
}

function lineCapacity(options: {
  title: string;
  layout: SlideLayout;
  fontSize: number;
  safe: SafeArea;
}) {
  const { title, layout, fontSize, safe } = options;
  const titleH = title ? fontSize * 1.2 : 0;
  const gap = title ? fontSize * 0.4 : 0;
  const extra = layoutExtra(layout, fontSize);
  const available = safe.height - titleH - gap - extra;
  const raw = Math.floor(available / bodyLineHeight(fontSize));
  return Math.max(1, raw - 1);
}

function makeBeat(startLineIndex: number, endLineIndex: number, lines: string[]): Beat {
  return { startLineIndex, endLineIndex, lines };
}

function recommendedWrapChars(safeWidth: number, fontSize: number) {
  return Math.max(24, Math.min(80, Math.floor(safeWidth / (fontSize * 0.52))));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
