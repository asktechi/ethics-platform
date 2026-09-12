"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import { deriveSpeakerNotes } from "@/lib/presentation/speaker-notes";

const FONT_STEPS = ["text-sm", "text-base", "text-lg", "text-xl"] as const;

export function Teleprompter({
  initialWpm,
}: {
  initialWpm: number;
}) {
  const assignments = usePresentationBus((s) => s.assignments);
  const index = usePresentationBus((s) => s.currentSlideIndex);
  const scrolling = usePresentationBus((s) => s.teleprompterScrolling);
  const [wpm, setWpm] = useState(initialWpm);
  const [font, setFont] = useState(1);
  const [markers, setMarkers] = useState<Set<string>>(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const slideStarted = useRef(Date.now());
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    slideStarted.current = Date.now();
    setElapsedMs(0);
  }, [index]);

  useEffect(() => {
    if (!scrolling) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - slideStarted.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [scrolling, index]);

  const current = assignments[index] ?? null;
  const upcoming = assignments.slice(index + 1, index + 3);
  const notes = useMemo(() => deriveSpeakerNotes(current, wpm), [current, wpm]);
  const spokenWords = Math.min(notes.wordCount, Math.floor((elapsedMs / 1000) * (wpm / 60)));

  useEffect(() => {
    const node = wordRefs.current[spokenWords];
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [spokenWords]);

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
        <ScriptBlock
          label="Now"
          text={notes.teleprompterText}
          className={FONT_STEPS[font]}
          highlight
          spokenWords={spokenWords}
          slideId={current?.slideId ?? "none"}
          markers={markers}
          onWordClick={(key) =>
            setMarkers((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          wordRefs={wordRefs}
        />
        {upcoming.map((slide) => (
          <ScriptBlock
            key={slide.slideId}
            label="Up next"
            text={deriveSpeakerNotes(slide, wpm).teleprompterText}
            className={`${FONT_STEPS[font]} opacity-40`}
            highlight={false}
            spokenWords={-1}
            slideId={slide.slideId}
            markers={markers}
            onWordClick={(key) =>
              setMarkers((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
          />
        ))}
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[10px] text-ivory/40">
        {notes.wordCount} words · ~{Math.round(notes.estimatedSeconds)}s at {wpm} WPM. Click a word
        to drop a pause marker (visual only).
      </p>
    </div>
  );
}

function ScriptBlock({
  label,
  text,
  className,
  highlight,
  spokenWords,
  slideId,
  markers,
  onWordClick,
  wordRefs,
}: {
  label: string;
  text: string;
  className: string;
  highlight: boolean;
  spokenWords: number;
  slideId: string;
  markers: Set<string>;
  onWordClick: (key: string) => void;
  wordRefs?: React.MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <section className="mb-8">
      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-ivory/35">{label}</p>
      <p className={`leading-8 text-ivory ${className}`}>
        {words.length === 0 ? (
          <span className="italic opacity-40">No speaker notes on this slide.</span>
        ) : (
          words.map((word, index) => {
            const key = `${slideId}:${index}`;
            const active = highlight && index === spokenWords;
            const passed = highlight && index < spokenWords;
            return (
              <span
                key={key}
                ref={(node) => {
                  if (wordRefs && highlight) wordRefs.current[index] = node;
                }}
                role="button"
                tabIndex={0}
                onClick={() => onWordClick(key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onWordClick(key);
                  }
                }}
                className={`mr-[0.35em] inline-block cursor-pointer rounded-sm ${
                  markers.has(key) ? "border-b-2 border-gold" : ""
                } ${active ? "bg-gold/30 text-ivory" : passed ? "text-ivory/55" : ""}`}
              >
                {word}
              </span>
            );
          })
        )}
      </p>
    </section>
  );
}
