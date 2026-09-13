import {
  beatIndexForLine,
  getPaginationViewport,
  paginateSlide,
  type PaginationResult,
} from "@/lib/presentation/beats";
import { deriveSpeakerNotes } from "@/lib/presentation/speaker-notes";
import type { SlideAssignment } from "@/lib/presentation/types";

export type AudienceRevealMode = "progressive" | "instant";

export type AudienceMirrorModel = {
  pagination: PaginationResult;
  beatIndex: number;
  revealLineCount: number;
  revealLines: string[];
};

/**
 * Single derivation for host center + audience page.
 * revealLineCount: -1 all, >=0 lines 0..N of the current beat, < -1 none.
 */
export function audienceMirrorModel(options: {
  slide: SlideAssignment;
  currentBeatIndex: number;
  teleprompterLineIndex: number;
  revealFlushed: boolean;
  revealMode: AudienceRevealMode;
}): AudienceMirrorModel {
  const revealLines = deriveSpeakerNotes(options.slide).revealLines;
  const pagination = paginateSlide({
    slide: {
      id: options.slide.slideId,
      title: options.slide.title,
      body: options.slide.body,
    },
    lines: revealLines,
    viewport: getPaginationViewport(),
    layout: options.slide.layout,
  });
  const beatIndex = Math.min(
    Math.max(0, options.currentBeatIndex),
    Math.max(0, pagination.beats.length - 1),
  );
  const beat = pagination.beats[beatIndex];
  let revealLineCount = -1;
  if (options.revealMode === "progressive" && !options.revealFlushed) {
    if (options.teleprompterLineIndex < 0) revealLineCount = -2;
    else revealLineCount = options.teleprompterLineIndex - (beat?.startLineIndex ?? 0);
  }
  return { pagination, beatIndex, revealLineCount, revealLines };
}

export function snapBeatIndex(pagination: PaginationResult, lineIndex: number) {
  return beatIndexForLine(pagination.beats, lineIndex);
}
