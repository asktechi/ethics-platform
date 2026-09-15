"use client";

import { useEffect, useMemo, useRef } from "react";
import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import { audienceMirrorModel } from "@/lib/presentation/mirror";
import { PHASE75A_GRADIENT, PHASE75A_NEXT } from "@/lib/presentation/phase75a-fixtures";

export default function Phase75aPreviewPage() {
  const index = usePresentationBus((s) => s.currentSlideIndex);
  const currentBeatIndex = usePresentationBus((s) => s.currentBeatIndex);
  const teleprompterLineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const revealFlushed = usePresentationBus((s) => s.revealFlushed);
  const slides = useMemo(() => [PHASE75A_GRADIENT, PHASE75A_NEXT], []);
  const slide = slides[Math.min(index, slides.length - 1)] ?? PHASE75A_GRADIENT;
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    dispatch({
      type: "HYDRATE",
      state: {
        mode: "audience",
        assignments: slides,
        slideCount: slides.length,
        currentSlideIndex: 0,
        currentBeatIndex: 0,
        teleprompterLineIndex: -1,
        revealFlushed: true,
        isPaused: false,
      },
    });
  }, [slides]);

  const mirror = audienceMirrorModel({
    slide,
    currentBeatIndex,
    teleprompterLineIndex,
    revealFlushed: true,
    revealMode: "instant",
  });

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#050d14] text-ivory">
      <div className="pointer-events-auto absolute left-3 top-3 z-30 flex flex-wrap gap-2">
        <button
          type="button"
          className="bg-black/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-ivory/80"
          onClick={() => dispatch({ type: "PREV" })}
        >
          Prev
        </button>
        <button
          type="button"
          data-next-slide="true"
          className="bg-gold px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-navy"
          onClick={() => dispatch({ type: "NEXT" })}
        >
          Next
        </button>
        <span className="bg-black/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-ivory/70">
          Gradient quality · slide {index + 1}/{slides.length} · zero images
        </span>
      </div>
      <AudienceMirror
        slide={slide}
        beat={mirror.beatIndex}
        theme={slide.theme}
        imageUrl={null}
        imageAttribution={null}
        revealLineCount={-1}
        showChrome={false}
        fillViewport
      />
    </main>
  );
}
