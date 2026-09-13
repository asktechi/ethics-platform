"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { paginateAssignment } from "@/lib/presentation/beats";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import {
  deriveSpeakerNotes,
  lineIndexForWords,
  revealIndexForSpoken,
  wordCountOf,
} from "@/lib/presentation/speaker-notes";

const FONT_STEPS = ["text-sm", "text-base", "text-lg", "text-xl"] as const;
const LINE_DEBOUNCE_MS = 200;

export function Teleprompter({
  initialWpm,
}: {
  initialWpm: number;
}) {
  const assignments = usePresentationBus((s) => s.assignments);
  const index = usePresentationBus((s) => s.currentSlideIndex);
  const scrolling = usePresentationBus((s) => s.teleprompterScrolling);
  const busLine = usePresentationBus((s) => s.teleprompterLineIndex);
  const busBeat = usePresentationBus((s) => s.currentBeatIndex);
  const [wpm, setWpm] = useState(initialWpm);
  const [font, setFont] = useState(1);
  const [markers, setMarkers] = useState<Set<string>>(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const accumulated = useRef(0);
  const lastTick = useRef(Date.now());
  const lastSentLine = useRef<number | null>(null);
  const debounceAt = useRef(0);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);

  useEffect(() => {
    accumulated.current = 0;
    lastTick.current = Date.now();
    setElapsedMs(0);
    lastSentLine.current = null;
  }, [index]);

  useEffect(() => {
    if (!scrolling) {
      lastTick.current = Date.now();
      return;
    }
    lastTick.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      accumulated.current += now - lastTick.current;
      lastTick.current = now;
      setElapsedMs(accumulated.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [scrolling, index]);

  const current = assignments[index] ?? null;
  const upcoming = assignments.slice(index + 1, index + 3);
  const notes = useMemo(() => deriveSpeakerNotes(current, wpm), [current, wpm]);
  const spokenWords = Math.min(notes.wordCount, Math.floor((elapsedMs / 1000) * (wpm / 60)));
  const currentLine = revealIndexForSpoken(notes.lines, notes.revealLines, spokenWords);
  const displayLine = lineIndexForWords(notes.lines, spokenWords);

  useEffect(() => {
    const node = lineRefs.current[Math.max(0, displayLine)];
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [displayLine]);

  useEffect(() => {
    if (!current) return;
    if (busLine === lastSentLine.current) return;
    if (busLine < 0) {
      accumulated.current = 0;
      lastTick.current = Date.now();
      setElapsedMs(0);
      lastSentLine.current = null;
      return;
    }
    const beats = paginateAssignment(current).beats;
    const start = beats[busBeat]?.startLineIndex ?? 0;
    if (busLine < start) return;
    const wordsBefore = wordsBeforeRevealLine(notes, busLine);
    accumulated.current = (wordsBefore / (wpm / 60)) * 1000;
    lastTick.current = Date.now();
    setElapsedMs(accumulated.current);
    lastSentLine.current = busLine;
  }, [busBeat, busLine, current, notes, wpm]);

  useEffect(() => {
    if (currentLine === lastSentLine.current) return;
    if (!current) return;
    const beats = paginateAssignment(current).beats;
    const minLine = beats[busBeat]?.startLineIndex ?? 0;
    if (currentLine >= 0 && currentLine < minLine) return;
    const wait = Math.max(0, LINE_DEBOUNCE_MS - (Date.now() - debounceAt.current));
    const timer = window.setTimeout(() => {
      lastSentLine.current = currentLine;
      debounceAt.current = Date.now();
      dispatch({
        type: "TELEPROMPTER_LINE",
        slideIndex: index,
        lineIndex: currentLine,
      });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [busBeat, current, currentLine, index]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#07131f]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Teleprompter</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: scrolling ? "PAUSE" : "RESUME" })}
        >
          {scrolling ? "Pause scroll" : "Play scroll"}
        </Button>
        <label className="flex items-center gap-2 text-[11px] text-ivory/70">
          WPM
          <input
            type="range"
            min={60}
            max={200}
            value={wpm}
            onChange={(event) => setWpm(Number(event.target.value))}
            className="w-24 accent-[#C9A227]"
          />
          <span className="w-8 font-mono text-ivory">{wpm}</span>
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setFont((value) => (value + 1) % FONT_STEPS.length)}
        >
          Aa
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <section className="mb-8">
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ivory/35">Now</p>
          {notes.lines.length === 0 ? (
            <p className={`italic text-ivory/40 ${FONT_STEPS[font]}`}>No speaker notes on this slide.</p>
          ) : (
            notes.lines.map((line, lineNumber) => {
              const active = lineNumber === displayLine;
              const passed = lineNumber < displayLine;
              return (
                <p
                  key={`${current?.slideId ?? "none"}:${lineNumber}`}
                  ref={(node) => {
                    lineRefs.current[lineNumber] = node;
                  }}
                  data-prompter-line={lineNumber}
                  className={`mb-3 border-l-2 pl-3 leading-8 text-ivory ${FONT_STEPS[font]} ${
                    active
                      ? "border-gold bg-gold/15"
                      : passed
                        ? "border-transparent text-ivory/55"
                        : "border-transparent text-ivory/35"
                  }`}
                >
                  {line.split(/\s+/).map((word, wordIndex) => {
                    const key = `${current?.slideId ?? "none"}:${lineNumber}:${wordIndex}`;
                    return (
                      <span
                        key={key}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setMarkers((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setMarkers((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }
                        }}
                        className={`mr-[0.35em] inline-block cursor-pointer ${
                          markers.has(key) ? "border-b-2 border-gold" : ""
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </p>
              );
            })
          )}
        </section>
        {upcoming.map((slide) => {
          const nextNotes = deriveSpeakerNotes(slide, wpm);
          return (
            <section key={slide.slideId} className="mb-8 opacity-40">
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ivory/35">Up next</p>
              <p className={`leading-8 text-ivory ${FONT_STEPS[font]}`}>{nextNotes.teleprompterText}</p>
            </section>
          );
        })}
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[10px] text-ivory/40">
        {notes.wordCount} words · {notes.revealLines.length} reveal lines · ~
        {Math.round(notes.estimatedSeconds)}s at {wpm} WPM. Click a word to drop a pause marker
        (visual only).
      </p>
    </div>
  );
}

function wordsBeforeRevealLine(
  notes: ReturnType<typeof deriveSpeakerNotes>,
  revealIndex: number,
) {
  if (revealIndex <= 0) return 0;
  const text = notes.revealLines[revealIndex];
  const allIndex = text ? notes.lines.indexOf(text) : -1;
  const through = allIndex >= 0 ? allIndex : revealIndex;
  return notes.lines.slice(0, through).reduce((sum, line) => sum + wordCountOf(line), 0);
}
