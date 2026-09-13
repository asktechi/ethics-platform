"use client";

import { SlideThumb } from "@/components/presentation/SlideThumb";
import { formatClock, formatFinish } from "@/lib/presentation/format";
import { deriveSpeakerNotes } from "@/lib/presentation/speaker-notes";
import { usePresentationBus } from "@/lib/presentation/bus";

export function NextUpPanel({
  totalElapsed,
  slideElapsed,
  audienceCount,
  connected,
  wpm,
}: {
  totalElapsed: number;
  slideElapsed: number;
  audienceCount: number;
  connected: boolean;
  wpm: number;
}) {
  const assignments = usePresentationBus((s) => s.assignments);
  const index = usePresentationBus((s) => s.currentSlideIndex);
  const next = assignments[index + 1] ?? null;
  const titles = assignments.slice(index + 1, index + 4);

  const remaining = assignments.slice(index + 1);
  const remainingSeconds = remaining.reduce(
    (sum, slide) => sum + deriveSpeakerNotes(slide, wpm).estimatedSeconds,
    0,
  );
  const finish = new Date(Date.now() + remainingSeconds * 1000);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#08141f]">
      <div className="border-b border-white/10 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Next up</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {next ? (
          <div className="aspect-[16/10] overflow-hidden border border-white/10">
            <SlideThumb slide={next} />
          </div>
        ) : (
          <p className="text-xs text-ivory/45">Last slide.</p>
        )}
        <ol className="space-y-1.5">
          {titles.map((slide, offset) => (
            <li key={slide.slideId} className="text-xs leading-5 text-ivory/70">
              <span className="font-mono text-ivory/35">{index + offset + 2}.</span> {slide.title}
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-1.5 border-t border-white/10 px-3 py-3 text-[11px] text-ivory/70">
        <p>Elapsed {formatClock(totalElapsed)}</p>
        <p>This slide {formatClock(slideElapsed)}</p>
        <p>Projected finish {remaining.length ? formatFinish(finish) : "now"}</p>
        <p className={connected ? "text-emerald-300" : "text-amber-200"}>
          Audience {audienceCount} {connected ? "live" : "offline"}
        </p>
      </div>
    </aside>
  );
}
