"use client";

/**
 * Only AudienceMirror renders audience-facing slide content. Do not
 * fork this component.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { ThemeBackground } from "@/components/presentation/ThemeBackground";
import { beatIndexForLine, paginateSlide } from "@/lib/presentation/beats";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
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
  const lastBeatCount = useRef(0);
  const logged = useRef<string>("");

  const revealLines = useMemo(() => deriveSpeakerNotes(slide).revealLines, [slide]);
  const ready = viewport.width > 0 && viewport.height > 0;
  const pagination = useMemo(() => {
    if (!ready) return null;
    return paginateSlide({
      slide: { id: slide.slideId, title: slide.title, body: slide.body },
      lines: revealLines,
      viewport,
      layout: slide.layout,
    });
  }, [ready, revealLines, slide, viewport]);

  const beatCount = pagination?.beats.length ?? 1;
  const beatIndex = Math.min(Math.max(0, beat), Math.max(0, beatCount - 1));
  const currentBeat = pagination?.beats[beatIndex] ?? pagination?.beats[0];
  const headlineSize = pagination?.fontSize ?? 96;
  const bodySize = headlineSize * 0.72;
  const safe = useMemo(
    () =>
      pagination?.safeArea ?? {
        horizontal: 0,
        vertical: 0,
        width: 0,
        height: 0,
      },
    [pagination],
  );

  useEffect(() => {
    if (!pagination || !ready) return;
    const key = `${slide.slideId}:${viewport.width}x${viewport.height}:${headlineSize}`;
    if (logged.current === key) return;
    logged.current = key;
    const applied = {
      fontSize: `${headlineSize}px`,
      lineHeight: 1.2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: safe.width,
      maxHeight: safe.height,
      padding: 0,
    };
    console.log("[phase46g] diagnostic", {
      a_useViewport: viewport,
      b_safeArea: {
        horizontalMargin: safe.horizontal,
        verticalMargin: safe.vertical,
        safeWidth: safe.width,
        safeHeight: safe.height,
      },
      c_paginateSlide: {
        beats: pagination.beats.length,
        fontSize: pagination.fontSize,
        lineHeight: pagination.lineHeight,
        maxLineChars: pagination.maxLineChars,
      },
      d_headlineContainer: applied,
    });
  }, [headlineSize, pagination, ready, safe, slide.slideId, viewport]);

  useEffect(() => {
    if (!pagination) return;
    if (lastBeatCount.current > 0 && lastBeatCount.current !== beatCount) {
      const snapped = beatIndexForLine(pagination.beats, lineIndex);
      if (snapped !== beatIndex) {
        dispatch({ type: "BEAT", slideIndex, beatIndex: snapped });
      }
    }
    lastBeatCount.current = beatCount;
  }, [beatCount, beatIndex, lineIndex, pagination, slideIndex]);

  const text = ensureAaText(theme.text ?? "#F5F1E8", theme.bg ?? "#0B1B2B");
  const align =
    slide.layout === "hook" || slide.layout === "question" || slide.layout === "cue"
      ? "center"
      : "left";

  return (
    <article
      data-audience-mirror="true"
      data-slide-id={slide.slideId}
      data-beat-index={beatIndex}
      data-beat-count={beatCount}
      data-font-size={headlineSize}
      data-reveal-count={revealLineCount}
      data-show-chrome={showChrome ? "true" : "false"}
      data-viewport={`${viewport.width}x${viewport.height}`}
      className="relative isolate h-full w-full overflow-hidden"
      style={{ color: text }}
    >
      <ThemeBackground slideId={slide.slideId} theme={theme} imageUrl={imageUrl} />
      <div
        className="absolute inset-0 z-10"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ready && pagination && currentBeat ? (
          <div
            style={{
              maxWidth: safe.width,
              maxHeight: safe.height,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
        ) : null}
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
  const headlineStyle: CSSProperties = {
    fontFamily: "var(--font-playfair), Georgia, serif",
    fontWeight: 600,
    fontSize: `${headlineSize}px`,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    margin: 0,
  };
  const bodyStyle: CSSProperties = {
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    fontWeight: 400,
    fontSize: `${bodySize}px`,
    lineHeight: 1.5,
  };

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
    <div
      className={slide.layout === "scenario" ? "px-10 py-8" : undefined}
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
          style={{ color: accent, fontSize: `${headlineSize * 1.15}px` }}
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
          fontSize: `${Math.min(fontSize, 72)}px`,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        Hold this thought
      </p>
    </div>
  );
}
