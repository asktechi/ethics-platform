"use client";

/**
 * Only AudienceMirror renders audience-facing slide content. Do not
 * fork this component.
 *
 * Phase 7.4: the stage fills the viewport (or the host center pane).
 * Type uses CSS clamp and never shrinks below 16px body / 32px head.
 * Overflow scrolls. Beat pagination stays on CANONICAL_VIEWPORT.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ThemeBackground } from "@/components/presentation/ThemeBackground";
import { beatIndexForLine, paginateAssignment } from "@/lib/presentation/beats";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import { ensureAaText } from "@/lib/presentation/contrast";
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
  /** Full viewport stage (standalone audience). Host preview leaves this false. */
  fillViewport?: boolean;
};

const HINT_MS = 3000;

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const pagination = useMemo(() => paginateAssignment(slide), [slide]);

  const beatCount = pagination.beats.length;
  const beatIndex = Math.min(Math.max(0, beat), Math.max(0, beatCount - 1));
  const currentBeat = pagination.beats[beatIndex] ?? pagination.beats[0];
  const hostLineInBeat =
    currentBeat && lineIndex >= 0 ? lineIndex - currentBeat.startLineIndex : -1;

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
    const node = contentRef.current;
    if (!node) return;
    node.scrollTo({ top: 0, behavior: "smooth" });
  }, [slide.slideId, beatIndex]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    let hintTimer: number | null = null;
    const measure = () => {
      const next = node.scrollHeight > node.clientHeight + 8;
      setOverflowing(next);
      if (next && node.scrollTop < 12) {
        setShowHint(true);
        if (hintTimer) window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setShowHint(false), HINT_MS);
      } else {
        setShowHint(false);
      }
    };
    const onScroll = () => {
      if (hintTimer) window.clearTimeout(hintTimer);
      setShowHint(false);
      hintTimer = window.setTimeout(() => {
        if (node.scrollHeight > node.clientHeight + 8 && node.scrollTop < 12) {
          setShowHint(true);
          hintTimer = window.setTimeout(() => setShowHint(false), HINT_MS);
        }
      }, HINT_MS);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", onScroll);
      if (hintTimer) window.clearTimeout(hintTimer);
    };
  }, [slide.slideId, beatIndex, revealLineCount]);

  const text = ensureAaText(theme.text ?? "#F5F1E8", theme.bg ?? "#0B1B2B");
  const align =
    slide.layout === "hook" || slide.layout === "question" || slide.layout === "cue"
      ? "center"
      : "left";
  const stageImage = slide.generatedImageUrl || imageUrl;
  const assignments = usePresentationBus((s) => s.assignments);
  const progress =
    assignments.length > 0 ? ((slideIndex + (beatIndex + 1) / Math.max(1, beatCount)) / assignments.length) * 100 : 0;

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
      <ThemeBackground slideId={slide.slideId} theme={theme} imageUrl={stageImage} />
      {showChrome ? (
        <p className="relative z-20 shrink-0 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ivory/55">
          Audience view
        </p>
      ) : null}
      <div
        ref={contentRef}
        className={`slide-content relative z-10 ${overflowing ? "is-overflowing" : ""}`}
        data-slide-content="true"
      >
        {currentBeat ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${slide.slideId}:${beatIndex}`}
              className="w-full"
              style={{ textAlign: align }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3, ease: "easeOut" } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              {slide.layout === "cue" ? (
                <CueCard accent={theme.accent} text={text} />
              ) : (
                <BeatBody
                  slide={slide}
                  beat={currentBeat}
                  revealLineCount={revealLineCount}
                  accent={theme.accent}
                  text={text}
                  hostCurrentLine={showChrome ? hostLineInBeat : -1}
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
      {overflowing && showHint ? (
        <p
          data-scroll-hint="true"
          className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ivory/80"
        >
          ↓
        </p>
      ) : null}
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

function BeatBody({
  slide,
  beat,
  revealLineCount,
  accent,
  text,
  hostCurrentLine,
}: {
  slide: SlideAssignment;
  beat: { lines: string[]; leftLines?: string[]; rightLines?: string[] };
  revealLineCount: number;
  accent: string;
  text: string;
  hostCurrentLine: number;
}) {
  const title = slide.title.trim();
  const showAll = revealLineCount === -1;
  const visibleThrough = showAll ? beat.lines.length - 1 : revealLineCount;

  if (slide.layout === "contrast") {
    const left = beat.leftLines ?? beat.lines;
    const right = beat.rightLines ?? [];
    return (
      <div>
        {title ? <h1 className="slide-headline">{title}</h1> : null}
        <div className="mt-8 grid min-w-0 grid-cols-2 gap-0">
          <div className="min-w-0 pr-4 sm:pr-8" style={{ borderRight: `1px solid ${accent}66` }}>
            <RevealStack
              lines={left}
              visibleThrough={showAll ? left.length - 1 : visibleThrough}
              hostCurrentLine={hostCurrentLine}
              accent={accent}
            />
          </div>
          <div className="min-w-0 pl-4 sm:pl-8">
            <RevealStack
              lines={right}
              visibleThrough={showAll ? right.length - 1 : visibleThrough}
              hostCurrentLine={-1}
              accent={accent}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={slide.layout === "scenario" ? "px-6 py-6 sm:px-10 sm:py-8" : undefined}
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
      {title ? <h1 className="slide-headline">{title}</h1> : null}
      {slide.layout === "question" ? (
        <p className="slide-headline mt-6 opacity-80" style={{ color: accent }}>
          ?
        </p>
      ) : null}
      {slide.layout === "hook" && title && visibleThrough >= 0 ? (
        <div className="mx-auto my-6 h-px w-24" style={{ backgroundColor: accent }} />
      ) : null}
      <RevealStack
        lines={beat.lines}
        visibleThrough={visibleThrough}
        hostCurrentLine={hostCurrentLine}
        accent={accent}
        style={{
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
  hostCurrentLine,
  accent,
  style,
}: {
  lines: string[];
  visibleThrough: number;
  hostCurrentLine: number;
  accent: string;
  style?: CSSProperties;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="slide-body" style={style}>
      {lines.map((line, index) => {
        if (index > visibleThrough) return null;
        const older = index < visibleThrough - 2;
        const isHostCurrent = hostCurrentLine === index;
        return (
          <motion.p
            key={`${index}:${line}`}
            data-reveal-line={index}
            data-host-current={isHostCurrent ? "true" : "false"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: older ? 0.75 : 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={isHostCurrent ? "border-l-2 pl-3" : undefined}
            style={{
              margin: 0,
              marginBottom: 10,
              borderColor: isHostCurrent ? accent : "transparent",
            }}
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
}: {
  accent: string;
  text: string;
}) {
  return (
    <div
      className="mx-auto max-w-3xl border px-8 py-10 text-center sm:px-16 sm:py-14"
      style={{ borderColor: `${accent}55`, color: text }}
    >
      <p className="text-[14px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
        Brief pause
      </p>
      <p className="slide-headline mt-6">Hold this thought</p>
    </div>
  );
}
