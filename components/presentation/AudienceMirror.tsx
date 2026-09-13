"use client";

/**
 * Only AudienceMirror renders audience-facing slide content. Do not
 * fork this component.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePresentationBus } from "@/lib/presentation/bus";
import { ThemeBackground } from "@/components/presentation/ThemeBackground";
import {
  beatIndexForLine,
  CANONICAL_VIEWPORT,
  paginateSlide,
} from "@/lib/presentation/beats";
import { dispatch } from "@/lib/presentation/bus";
import { ensureAaText } from "@/lib/presentation/contrast";
import { deriveSpeakerNotes } from "@/lib/presentation/speaker-notes";
import type { SlideAssignment } from "@/lib/presentation/types";
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
};

const STAGE = CANONICAL_VIEWPORT;

export function AudienceMirror({
  slide,
  beat,
  theme,
  imageUrl,
  imageAttribution,
  revealLineCount,
  showChrome,
}: AudienceMirrorProps) {
  const viewport = useViewport();
  const slideIndex = usePresentationBus((s) => s.currentSlideIndex);
  const lineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const lockedSlide = useRef<string | null>(null);
  const lastBeatCount = useRef(0);

  const revealLines = useMemo(() => deriveSpeakerNotes(slide).revealLines, [slide]);
  const pagination = useMemo(() => {
    void viewport.width;
    void viewport.height;
    return paginateSlide({
      slide: { id: slide.slideId, title: slide.title, body: slide.body },
      lines: revealLines,
      viewport: STAGE,
      layout: slide.layout,
    });
  }, [slide, revealLines, viewport.width, viewport.height]);

  const beatCount = pagination.beats.length;
  const beatIndex = Math.min(Math.max(0, beat), Math.max(0, beatCount - 1));
  const currentBeat = pagination.beats[beatIndex] ?? pagination.beats[0];

  useLayoutEffect(() => {
    if (lockedSlide.current === slide.slideId) return;
    const node = rootRef.current;
    const width = node?.clientWidth ?? viewport.width;
    const height = node?.clientHeight ?? viewport.height;
    if (width < 8 || height < 8) return;
    const next = Math.min(width / STAGE.width, height / STAGE.height);
    if (!Number.isFinite(next) || next <= 0) return;
    setScale(next);
    lockedSlide.current = slide.slideId;
  }, [slide.slideId, viewport.height, viewport.width]);

  useEffect(() => {
    if (lastBeatCount.current > 0 && lastBeatCount.current !== beatCount) {
      const snapped = beatIndexForLine(pagination.beats, lineIndex);
      if (snapped !== beatIndex) {
        dispatch({ type: "BEAT", slideIndex, beatIndex: snapped });
      }
    }
    lastBeatCount.current = beatCount;
  }, [beatCount, beatIndex, lineIndex, pagination.beats, slideIndex]);

  const text = ensureAaText(theme.text ?? "#F5F1E8", theme.bg ?? "#0B1B2B");
  const align =
    slide.layout === "hook" || slide.layout === "question" || slide.layout === "cue"
      ? "center"
      : "left";
  const headlineSize = pagination.fontSize;
  const bodySize = pagination.fontSize * 0.72;
  const safe = pagination.safeArea;

  return (
    <article
      ref={rootRef}
      data-audience-mirror="true"
      data-slide-id={slide.slideId}
      data-beat-index={beatIndex}
      data-beat-count={beatCount}
      data-font-size={headlineSize}
      data-reveal-count={revealLineCount}
      data-show-chrome={showChrome ? "true" : "false"}
      className="relative isolate h-full w-full overflow-hidden"
      style={{ color: text }}
    >
      <ThemeBackground slideId={slide.slideId} theme={theme} imageUrl={imageUrl} />
      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
        <div
          className="relative overflow-hidden"
          style={{
            width: STAGE.width,
            height: STAGE.height,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative flex items-center justify-center"
              style={{
                width: safe.width,
                maxWidth: safe.width,
                maxHeight: safe.height,
                height: "auto",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${slide.slideId}:${beatIndex}`}
                  className="w-full"
                  style={{ textAlign: align }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }}
                  exit={{ opacity: 0, y: 0, transition: { duration: 0.2 } }}
                >
                  {slide.layout === "cue" ? (
                    <CueCard accent={theme.accent} text={text} fontSize={headlineSize} />
                  ) : (
                    <BeatBody
                      slide={slide}
                      beat={currentBeat}
                      revealLineCount={revealLineCount}
                      headlineSize={headlineSize}
                      bodySize={bodySize}
                      accent={theme.accent}
                      text={text}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {showChrome ? (
        <p className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.22em] text-ivory/55">
          Audience view
        </p>
      ) : null}
      {showChrome && imageAttribution ? (
        <p className="pointer-events-none absolute bottom-3 right-4 z-20 max-w-[46%] text-right text-[10px] uppercase tracking-[0.14em] text-ivory/40">
          {imageAttribution}
        </p>
      ) : null}
    </article>
  );
}

function BeatBody({
  slide,
  beat,
  revealLineCount,
  headlineSize,
  bodySize,
  accent,
  text,
}: {
  slide: SlideAssignment;
  beat: { lines: string[]; leftLines?: string[]; rightLines?: string[] };
  revealLineCount: number;
  headlineSize: number;
  bodySize: number;
  accent: string;
  text: string;
}) {
  const title = slide.title.trim();
  const showAll = revealLineCount === -1;
  const visibleThrough = showAll ? beat.lines.length - 1 : revealLineCount;
  const visible = visibleThrough < 0 ? [] : beat.lines.filter((_, index) => index <= visibleThrough);
  const headlineStyle = {
    fontFamily: "var(--font-playfair), Georgia, serif",
    fontWeight: 600,
    fontSize: `clamp(34px, ${headlineSize}px, ${headlineSize}px)`,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  } as const;
  const bodyStyle = {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    fontWeight: 400,
    fontSize: `clamp(24px, ${bodySize}px, ${bodySize}px)`,
    lineHeight: 1.5,
  } as const;

  if (slide.layout === "contrast") {
    const left = beat.leftLines ?? visible;
    const right = beat.rightLines ?? [];
    const leftVisible = showAll || visibleThrough < 0 ? left : left.filter((_, i) => i <= visibleThrough);
    const rightVisible =
      showAll || visibleThrough < 0 ? right : right.filter((_, i) => i <= visibleThrough);
    return (
      <div>
        {title ? <h1 style={headlineStyle}>{title}</h1> : null}
        <div className="mt-8 grid grid-cols-2 gap-0">
          <div className="pr-8" style={{ borderRight: `1px solid ${accent}66` }}>
            <RevealStack lines={leftVisible} visibleThrough={leftVisible.length - 1} style={bodyStyle} />
          </div>
          <div className="pl-8">
            <RevealStack
              lines={rightVisible}
              visibleThrough={rightVisible.length - 1}
              style={bodyStyle}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={slide.layout === "scenario" ? "px-10 py-8" : undefined}
      style={
        slide.layout === "scenario"
          ? { border: `1px solid ${accent}80`, backgroundColor: "rgba(0,0,0,0.28)" }
          : undefined
      }
    >
      {slide.layout === "scenario" ? (
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: accent }}
        >
          Scenario
        </p>
      ) : null}
      {title ? <h1 style={headlineStyle}>{title}</h1> : null}
      {slide.layout === "question" ? (
        <p
          className="mt-6 font-display leading-none opacity-80"
          style={{ color: accent, fontSize: headlineSize * 1.15 }}
        >
          ?
        </p>
      ) : null}
      {slide.layout === "hook" && title && visible.length > 0 ? (
        <div className="mx-auto my-6 h-px w-24" style={{ backgroundColor: accent }} />
      ) : null}
      <RevealStack
        lines={visible}
        visibleThrough={visible.length - 1}
        style={{
          ...bodyStyle,
          marginTop: title ? 28 : 0,
          textShadow: slide.layout === "reveal" ? `0 0 42px ${accent}99` : undefined,
          color: text,
        }}
      />
    </div>
  );
}

function RevealStack({
  lines,
  visibleThrough,
  style,
}: {
  lines: string[];
  visibleThrough: number;
  style: CSSProperties;
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      {lines.map((line, index) => {
        const older = index < visibleThrough - 2;
        return (
          <motion.p
            key={`${index}:${line}`}
            data-reveal-line={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: older ? 0.7 : 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ ...style, margin: 0, marginBottom: 10 }}
          >
            {line}
          </motion.p>
        );
      })}
    </div>
  );
}

function CueCard({
  accent,
  text,
  fontSize,
}: {
  accent: string;
  text: string;
  fontSize: number;
}) {
  return (
    <div className="mx-auto max-w-3xl border px-16 py-14 text-center" style={{ borderColor: `${accent}55`, color: text }}>
      <p className="text-[14px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
        Brief pause
      </p>
      <p
        className="mt-6"
        style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontWeight: 600,
          fontSize: `clamp(34px, ${Math.min(fontSize, 72)}px, 72px)`,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        Hold this thought
      </p>
    </div>
  );
}
