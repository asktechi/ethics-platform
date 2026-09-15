"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { SyncDebugDot } from "@/components/presentation/SyncDebugDot";
import { Teleprompter } from "@/components/presentation/Teleprompter";
import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import { audienceMirrorModel } from "@/lib/presentation/mirror";
import {
  PHASE74_ASPECTS,
  PHASE74_HOOK,
  PHASE74_LONG,
  PHASE74_SHORT,
  type Phase74Aspect,
} from "@/lib/presentation/phase74-fixtures";

function Frame({
  aspect,
  children,
}: {
  aspect: Phase74Aspect | "full";
  children: React.ReactNode;
}) {
  if (aspect === "full") {
    return <div className="h-[100dvh] w-screen overflow-hidden bg-navy">{children}</div>;
  }
  const box = PHASE74_ASPECTS[aspect];
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black p-4">
      <div
        data-aspect-frame={aspect}
        className="relative overflow-hidden border border-white/20"
        style={{ width: "min(100vw, 100%)", aspectRatio: `${box.width} / ${box.height}`, maxHeight: "100dvh" }}
      >
        {children}
      </div>
    </div>
  );
}

function Stage({
  slide,
  reveal,
  fillViewport,
  showChrome,
}: {
  slide: typeof PHASE74_SHORT;
  reveal: number;
  fillViewport: boolean;
  showChrome: boolean;
}) {
  const currentBeatIndex = usePresentationBus((s) => s.currentBeatIndex);
  const teleprompterLineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const revealFlushed = usePresentationBus((s) => s.revealFlushed);
  const mirror = audienceMirrorModel({
    slide,
    currentBeatIndex,
    teleprompterLineIndex,
    revealFlushed: revealFlushed || reveal === -1,
    revealMode: reveal === -1 ? "instant" : "progressive",
  });
  return (
    <AudienceMirror
      slide={slide}
      beat={mirror.beatIndex}
      theme={slide.theme}
      imageUrl={slide.generatedImageUrl || slide.imageUrl}
      imageAttribution={slide.imageAttribution}
      revealLineCount={reveal === -1 ? -1 : mirror.revealLineCount}
      showChrome={showChrome}
      fillViewport={fillViewport}
    />
  );
}

function Inner() {
  const params = useSearchParams();
  const view = params.get("view") ?? "short";
  const aspectParam = params.get("aspect");
  const aspect: Phase74Aspect | "full" =
    aspectParam && aspectParam in PHASE74_ASPECTS ? (aspectParam as Phase74Aspect) : "full";
  const reveal = params.get("reveal") === "all" ? -1 : Number.parseInt(params.get("reveal") ?? "-1", 10);
  const scrollMid = params.get("scroll") === "mid";
  const long = view === "long" || view === "host" || view === "dual";
  const slide = view === "hook" ? PHASE74_HOOK : long ? PHASE74_LONG : PHASE74_SHORT;
  const slides = useMemo(() => [slide, PHASE74_HOOK], [slide]);
  const bootKey = `${view}:${slide.slideId}:${reveal}`;
  const booted = useRef("");
  if (booted.current !== bootKey) {
    booted.current = bootKey;
    dispatch({
      type: "HYDRATE",
      state: {
        mode: view === "host" || view === "dual" ? "host" : "audience",
        assignments: slides,
        slideCount: slides.length,
        currentSlideIndex: 0,
        currentBeatIndex: 0,
        teleprompterLineIndex: reveal === -1 ? -1 : reveal,
        revealFlushed: reveal === -1,
        teleprompterScrolling: false,
        isPaused: false,
      },
    });
  }

  useEffect(() => {
    if (!scrollMid) return;
    const node = document.querySelector("[data-slide-content='true']");
    if (!(node instanceof HTMLElement)) return;
    const timer = window.setTimeout(() => {
      node.scrollTop = Math.max(80, (node.scrollHeight - node.clientHeight) * 0.45);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [scrollMid, view, slide.slideId]);

  if (view === "host" || view === "dual") {
    return (
      <div className="flex h-[100dvh] overflow-hidden bg-[#050d14]">
        <div className="hidden h-full w-[32%] min-w-0 shrink-0 md:block">
          <Teleprompter initialWpm={140} />
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <Stage slide={slide} reveal={reveal} fillViewport={false} showChrome />
          <SyncDebugDot role="host" />
        </div>
      </div>
    );
  }

  return (
    <Frame aspect={aspect}>
      <Stage
        slide={slide}
        reveal={Number.isFinite(reveal) ? reveal : -1}
        fillViewport={aspect === "full"}
        showChrome={false}
      />
      <SyncDebugDot role="audience" />
    </Frame>
  );
}

export default function Phase74PreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ivory/60">Loading audience fixtures…</p>}>
      <Inner />
    </Suspense>
  );
}
