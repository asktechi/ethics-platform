"use client";

/**
 * Only AudienceMirror renders audience-facing slide content. Do not
 * fork this component.
 *
 * Phase 7.6: the audience stage is a rolling bar of line cards.
 * TELEPROMPTER_LINE still drives revealLineCount. Beat pagination
 * stays on CANONICAL_VIEWPORT.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { JumpToLivePill, RollingBar, type RollingLine } from "@/components/presentation/RollingBar";
import { ThemeBackground } from "@/components/presentation/ThemeBackground";
import { beatIndexForLine, paginateAssignment } from "@/lib/presentation/beats";
import { dispatch, getPresentationState, usePresentationBus } from "@/lib/presentation/bus";
import { ensureAaText } from "@/lib/presentation/contrast";
import { slideStageImage } from "@/lib/presentation/prefetch";
import type { SlideAssignment } from "@/lib/presentation/types";
import { useAudienceScroll } from "@/lib/presentation/useAudienceScroll";
import { useViewport } from "@/lib/presentation/useViewport";
import type { ThemePalette } from "@/lib/themes/types";

export type AudienceMirrorProps = {
  slide: SlideAssignment;
  beat: number;
  theme: ThemePalette;
  imageUrl: string | null;
  imageAttribution: string | null;
  /** -1 = reveal all, else reveal lines 0..N of the current beat. < -1 = none. */
  revealLineCount: number;
  showChrome: boolean;
  /** Full viewport stage (standalone audience). Host preview leaves this false. */
  fillViewport?: boolean;
};

export function AudienceMirror({
  slide,
  beat,
  theme,
  imageUrl,
  imageAttribution,
  revealLineCount,
  showChrome,
  fillViewport = false,
}: AudienceMirrorProps) {
  const viewport = useViewport();
  const slideIndex = usePresentationBus((s) => s.currentSlideIndex);
  const lineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const lastBeatCount = useRef(0);
  const prevBeatKey = useRef(`${slide.slideId}:0`);
  const [overflowing, setOverflowing] = useState(false);
  const [bridge, setBridge] = useState<string | null>(null);

  const pagination = useMemo(() => paginateAssignment(slide), [slide]);
  const assignments = usePresentationBus((s) => s.assignments);

  const beatCount = pagination.beats.length;
  const beatIndex = Math.min(Math.max(0, beat), Math.max(0, beatCount - 1));
  const currentBeat = pagination.beats[beatIndex] ?? pagination.beats[0];
  const hostLineInBeat =
    currentBeat && lineIndex >= 0 ? lineIndex - currentBeat.startLineIndex : -1;

  const sourceLines = useMemo(() => {
    if (slide.layout === "cue") return ["Hold this thought"];
    if (slide.layout === "contrast") {
      const left = currentBeat?.leftLines ?? currentBeat?.lines ?? [];
      const right = currentBeat?.rightLines ?? [];
      const stacked = right.length ? [...left, ...right] : left;
      if (stacked.length) return stacked;
    }
    const lines = currentBeat?.lines ?? [];
    if (lines.length) return lines;
    const title = slide.title.trim();
    return title ? [title] : [];
  }, [currentBeat, slide.layout, slide.title]);

  const showAll = revealLineCount === -1;
  const visibleThrough = showAll ? sourceLines.length - 1 : revealLineCount;
  const waiting = visibleThrough < 0 || sourceLines.length === 0;

  const rollingLines = useMemo((): RollingLine[] => {
    if (waiting) return [];
    const current = Math.max(0, visibleThrough);
    const cards: RollingLine[] = [];
    const title = slide.title.trim();
    const titleAlready = title && sourceLines.some((line) => line === title);
    if (title && !titleAlready) {
      const depthFromCurrent = current + 1;
      cards.push({
        id: `${slide.slideId}:title`,
        text: title,
        index: -1,
        depth: depthFromCurrent >= 3 ? "older" : (depthFromCurrent as 0 | 1 | 2),
      });
    }
    sourceLines.forEach((text, index) => {
      if (index > current) return;
      const delta = current - index;
      const depth = delta === 0 ? 0 : delta === 1 ? 1 : delta === 2 ? 2 : "older";
      cards.push({
        id: `${slide.slideId}:${beatIndex}:${index}:${text.slice(0, 24)}`,
        text,
        index,
        depth,
      });
    });
    return cards;
  }, [waiting, visibleThrough, sourceLines, slide.slideId, slide.title, beatIndex]);

  const hasUpcoming = !waiting && visibleThrough >= 0 && visibleThrough < sourceLines.length - 1;

  const scroll = useAudienceScroll({
    trackUserScroll: !showChrome,
    revealKey: `${slide.slideId}:${beatIndex}:${visibleThrough}`,
    resetKey: `${slide.slideId}:${beatIndex}`,
  });

  useEffect(() => {
    if (lastBeatCount.current > 0 && lastBeatCount.current !== beatCount) {
      const snapped = beatIndexForLine(pagination.beats, lineIndex);
      if (snapped !== beatIndex) {
        dispatch({ type: "BEAT", slideIndex, beatIndex: snapped });
      }
    }
    lastBeatCount.current = beatCount;
  }, [beatCount, beatIndex, lineIndex, pagination, slideIndex]);

  useEffect(() => {
    const key = `${slide.slideId}:${beatIndex}`;
    if (prevBeatKey.current === key) return;
    const hadPrior = prevBeatKey.current.length > 0;
    const slideChanged = hadPrior && !prevBeatKey.current.startsWith(`${slide.slideId}:`);
    prevBeatKey.current = key;
    if (slideChanged) {
      setBridge(`Slide ${slideIndex + 1} of ${Math.max(1, getPresentationState().assignments.length)}`);
      const timer = window.setTimeout(() => setBridge(null), 600);
      return () => window.clearTimeout(timer);
    }
  }, [slide.slideId, beatIndex, slideIndex]);

  useEffect(() => {
    const node = scroll.containerRef.current;
    if (!node) return;
    const measure = () => {
      setOverflowing(node.scrollHeight > node.clientHeight + 8);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scroll.containerRef, slide.slideId, beatIndex, rollingLines.length]);

  const text = ensureAaText(theme.text ?? "#F5F1E8", theme.bg ?? "#0B1B2B");
  const align =
    slide.layout === "hook" || slide.layout === "question" || slide.layout === "cue"
      ? "center"
      : "left";
  const stageImage = slide.generatedImageUrl || imageUrl || null;
  const nextUrl = slideStageImage(assignments[slideIndex + 1] ?? null);
  const progress =
    assignments.length > 0
      ? ((slideIndex + (beatIndex + 1) / Math.max(1, beatCount)) / assignments.length) * 100
      : 0;

  return (
    <article
      data-audience-mirror="true"
      data-slide-id={slide.slideId}
      data-beat-index={beatIndex}
      data-beat-count={beatCount}
      data-reveal-count={revealLineCount}
      data-show-chrome={showChrome ? "true" : "false"}
      data-overflowing={overflowing ? "true" : "false"}
      data-viewport={`${viewport.width}x${viewport.height}`}
      className={`relative isolate w-full ${fillViewport ? "audience-stage" : "audience-stage-embedded"}`}
      style={{ color: text }}
    >
      {nextUrl ? <link rel="preload" as="image" href={nextUrl} /> : null}
      <ThemeBackground
        slideId={slide.slideId}
        theme={theme}
        imageUrl={stageImage}
        attribution={imageAttribution}
      />
      {showChrome ? (
        <p className="relative z-20 shrink-0 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ivory/55">
          Audience view
        </p>
      ) : null}
      <div
        ref={scroll.containerRef}
        className="slide-content relative z-10"
        data-slide-content="true"
      >
        <AnimatePresence mode="wait" initial={false}>
          {bridge ? (
            <motion.div
              key={`bridge:${bridge}`}
              className="flex min-h-full items-center justify-center"
              data-slide-bridge="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-ivory/70">
                {bridge}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`${slide.slideId}:${beatIndex}`}
              className="w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }}
              exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            >
              <RollingBar
                lines={rollingLines}
                hasUpcoming={hasUpcoming}
                waiting={waiting}
                title={slide.title.trim()}
                accent={theme.accent}
                text={text}
                currentLineRef={scroll.currentLineRef}
                hostCurrentLine={showChrome ? hostLineInBeat : -1}
                align={align}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <JumpToLivePill visible={!showChrome && scroll.userScrolledUp} onJump={scroll.jumpToLive} />
      {showChrome && imageAttribution ? (
        <p className="pointer-events-none absolute bottom-3 right-4 z-20 max-w-[46%] text-right text-[10px] uppercase tracking-[0.14em] text-ivory/40">
          {imageAttribution}
        </p>
      ) : null}
      <div
        data-brand-bar="true"
        className="relative z-20 h-[4px] w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.accent} ${Math.min(100, progress)}%, ${theme.accent}33 ${Math.min(100, progress)}%)`,
        }}
      />
    </article>
  );
}
