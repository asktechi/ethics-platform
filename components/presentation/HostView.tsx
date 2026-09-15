"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  endPresentationAction,
  reshuffleLiveRunAction,
  syncRunProgressAction,
} from "@/app/(app)/_actions/presentation.actions";
import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { HostSummary } from "@/components/presentation/HostSummary";
import { SyncDebugDot } from "@/components/presentation/SyncDebugDot";
import { NextUpPanel } from "@/components/presentation/NextUpPanel";
import { SlideGrid } from "@/components/presentation/SlideGrid";
import { Teleprompter } from "@/components/presentation/Teleprompter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dispatch,
  getPresentationState,
  toggleRehearsalMode,
  usePresentationBus,
} from "@/lib/presentation/bus";
import { formatClock } from "@/lib/presentation/format";
import { mapHostKey } from "@/lib/presentation/keyboard";
import { audienceMirrorModel } from "@/lib/presentation/mirror";
import {
  injectPreloadLink,
  prefetchUpcomingImages,
  slideStageImage,
} from "@/lib/presentation/prefetch";
import { connectPresentationRealtime } from "@/lib/presentation/realtime";
import type { ConnectionStatus, SlideAssignment } from "@/lib/presentation/types";
import { createClient } from "@/lib/supabase/client";
import type { RunSettings } from "@/lib/themes/types";

export type HostViewProps = {
  classId: string;
  classTitle: string;
  runPk: string;
  publicRunId: string;
  status: "setup" | "live" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  settings: RunSettings;
  slides: SlideAssignment[];
  audienceUrl: string;
};

export function HostView(props: HostViewProps) {
  const [widths, setWidths] = useState([35, 45, 20]);
  const [gridOpen, setGridOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [audienceCount, setAudienceCount] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [slideElapsed, setSlideElapsed] = useState(0);
  const [reshuffleError, setReshuffleError] = useState<string | null>(null);
  const [audienceHref, setAudienceHref] = useState(props.audienceUrl);
  const [imageBusy, setImageBusy] = useState(false);
  const [prep, setPrep] = useState<{ ready: number; total: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const slideClock = useRef(Date.now());
  const startedMs = useMemo(
    () => (props.startedAt ? new Date(props.startedAt).getTime() : Date.now()),
    [props.startedAt],
  );

  const index = usePresentationBus((s) => s.currentSlideIndex);
  const mode = usePresentationBus((s) => s.mode);
  const ended = usePresentationBus((s) => s.ended);
  const assignments = usePresentationBus((s) => s.assignments);
  const slidesAdvanced = usePresentationBus((s) => s.slidesAdvanced);
  const peakAudience = usePresentationBus((s) => s.peakAudience);
  const scrolling = usePresentationBus((s) => s.teleprompterScrolling);
  const currentBeatIndex = usePresentationBus((s) => s.currentBeatIndex);
  const teleprompterLineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const revealFlushed = usePresentationBus((s) => s.revealFlushed);
  const current = assignments[index] ?? null;
  const mirror = current
    ? audienceMirrorModel({
        slide: current,
        currentBeatIndex,
        teleprompterLineIndex,
        revealFlushed,
        revealMode: props.settings.audience_reveal_mode ?? "progressive",
      })
    : null;

  useLayoutEffect(() => {
    if (!props.audienceUrl.startsWith("http") && typeof window !== "undefined") {
      setAudienceHref(`${window.location.origin}/present/${props.publicRunId}/audience`);
    }
    dispatch({
      type: "HYDRATE",
      state: {
        currentSlideIndex: Math.min(
          props.settings.current_slide_index ?? 0,
          Math.max(0, props.slides.length - 1),
        ),
        mode: "host",
        runId: props.publicRunId,
        assignments: props.slides,
        slideCount: props.slides.length,
        ended: props.status === "ended",
        slidesAdvanced: props.settings.slides_advanced ?? 0,
        peakAudience: props.settings.peak_audience ?? 0,
        teleprompterScrolling: true,
        teleprompterLineIndex: -1,
        currentBeatIndex: 0,
        isPaused: false,
      },
    });
  }, [props]);

  useEffect(() => {
    const urls = assignments.map((slide) => slideStageImage(slide));
    prefetchUpcomingImages(urls, index, 1);
    injectPreloadLink(urls[index + 1] ?? null);
  }, [assignments, index]);

  useEffect(() => {
    if (props.status !== "live" || !props.settings.auto_generate_images) return;
    let cancelled = false;
    async function preload() {
      setPrep({ ready: 0, total: Math.max(1, props.slides.length) });
      let remaining = 1;
      while (!cancelled && remaining > 0) {
        const response = await fetch(`/api/present/${props.publicRunId}/preload-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 1 }),
        });
        const json = (await response.json()) as {
          remaining?: number;
          ready?: number;
          total?: number;
          done?: boolean;
          results?: Array<{ slideId: string; url: string }>;
        };
        if (!response.ok) break;
        remaining = json.remaining ?? 0;
        setPrep({
          ready: json.ready ?? 0,
          total: json.total ?? props.slides.length,
        });
        if (json.results?.length) {
          dispatch({
            type: "SET_ASSIGNMENTS",
            assignments: getPresentationState().assignments.map((slide) => {
              const hit = json.results?.find((row) => row.slideId === slide.slideId);
              if (!hit) return slide;
              return {
                ...slide,
                generatedImageUrl: hit.url,
                imageStatus: "ready" as const,
              };
            }),
          });
        }
        if (json.done) break;
      }
      if (!cancelled) setPrep(null);
    }
    void preload();
    return () => {
      cancelled = true;
    };
  }, [props.publicRunId, props.settings.auto_generate_images, props.status, props.slides.length]);

  useEffect(() => {
    if (props.status !== "live" || props.slides.length === 0) return;
    const supabase = createClient();
    const handle = connectPresentationRealtime({
      supabase,
      runId: props.publicRunId,
      role: "host",
      onConnectionChange: setConnection,
      onPresence: (_total, audience) => {
        setAudienceCount(audience);
        dispatch({ type: "SET_PEAK_AUDIENCE", count: audience });
      },
    });
    return () => handle.disconnect();
  }, [props.publicRunId, props.status, props.slides.length]);

  useEffect(() => {
    slideClock.current = Date.now();
    setSlideElapsed(0);
    if (props.status !== "live" || ended) return;
    void syncRunProgressAction({
      classId: props.classId,
      runId: props.runPk,
      slideIndex: index,
      slidesAdvanced,
    });
  }, [index, ended, props.classId, props.runPk, props.status, slidesAdvanced]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTotalElapsed(Math.floor((Date.now() - startedMs) / 1000));
      setSlideElapsed(Math.floor((Date.now() - slideClock.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [startedMs]);

  const generateCurrentImage = useCallback(async () => {
    if (!current || imageBusy) return;
    setImageBusy(true);
    dispatch({
      type: "SET_ASSIGNMENTS",
      assignments: getPresentationState().assignments.map((slide) =>
        slide.slideId === current.slideId
          ? { ...slide, imageStatus: "generating" as const }
          : slide,
      ),
    });
    try {
      const hasAi = Boolean(current.generatedImageUrl);
      const path = hasAi
        ? `/api/slides/${current.slideId}/regenerate-image`
        : `/api/slides/${current.slideId}/generate-image`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await response.json()) as { url?: string; error?: string };
      dispatch({
        type: "SET_ASSIGNMENTS",
        assignments: getPresentationState().assignments.map((slide) => {
          if (slide.slideId !== current.slideId) return slide;
          if (!response.ok) return { ...slide, imageStatus: "failed" as const };
          return {
            ...slide,
            generatedImageUrl: json.url ?? slide.generatedImageUrl,
            imageStatus: "ready" as const,
          };
        }),
      });
    } catch {
      dispatch({
        type: "SET_ASSIGNMENTS",
        assignments: getPresentationState().assignments.map((slide) =>
          slide.slideId === current.slideId
            ? { ...slide, imageStatus: "failed" as const }
            : slide,
        ),
      });
    } finally {
      setImageBusy(false);
    }
  }, [current, imageBusy]);

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const action = mapHostKey(event);
      if (!action) return;
      event.preventDefault();
      if (action.kind === "bus") {
        dispatch(action.event);
        return;
      }
      if (action.kind === "toggle-prompter") {
        dispatch({ type: scrolling ? "PAUSE" : "RESUME" });
        return;
      }
      if (action.kind === "grid") {
        setGridOpen((open) => !open);
        return;
      }
      if (action.kind === "rehearsal") {
        toggleRehearsalMode();
        return;
      }
      if (action.kind === "generate-image") {
        void generateCurrentImage();
        return;
      }
      if (action.kind === "fullscreen") {
        if (!document.fullscreenElement) void rootRef.current?.requestFullscreen();
        return;
      }
      if (action.kind === "exit-fullscreen") {
        if (document.fullscreenElement) void document.exitFullscreen();
        setGridOpen(false);
        return;
      }
      if (action.kind === "confirm-end") setEndOpen(true);
    },
    [generateCurrentImage, scrolling],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  if (props.slides.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy px-6">
        <div className="max-w-lg text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">No deck</p>
          <h1 className="mt-3 font-display text-3xl text-ivory">
            Approve slides in the Materials tab first
          </h1>
          <p className="mt-3 text-sm text-ivory/60">
            The host view needs at least one approved slide before a run can go on screen.
          </p>
          <Link
            href={`/class/${props.classId}/materials`}
            className="mt-6 inline-block text-sm text-gold underline-offset-4 hover:underline"
          >
            Open Materials
          </Link>
        </div>
      </div>
    );
  }

  if (ended || props.status === "ended") {
    const endedMs = props.endedAt ? new Date(props.endedAt).getTime() : Date.now();
    return (
      <div className="fixed inset-0 z-[100]">
        <HostSummary
          classId={props.classId}
          totalSeconds={Math.floor((endedMs - startedMs) / 1000)}
          slidesAdvanced={slidesAdvanced}
          peakAudience={peakAudience}
          slideCount={assignments.length}
        />
      </div>
    );
  }

  const rehearsal = mode === "rehearsal";

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex flex-col bg-[#050d14] text-ivory">
      {connection !== "connected" ? (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-100">
          Live sync unavailable — check your network
        </div>
      ) : null}
      {rehearsal ? (
        <div className="bg-gold px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          Rehearsal — not broadcasting
        </div>
      ) : null}
      {prep ? (
        <div className="bg-navy/90 px-4 py-1.5" data-preparing-visuals="true">
          <p className="text-center text-[11px] uppercase tracking-[0.16em] text-ivory/70">
            Preparing visuals… {prep.ready} of {prep.total}
          </p>
          <div className="mx-auto mt-1 h-1 max-w-md bg-white/10">
            <div
              className="h-full bg-gold"
              style={{ width: `${Math.min(100, (prep.ready / Math.max(1, prep.total)) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-[28vh] lg:h-full" style={{ flexBasis: `${widths[0]}%`, flexGrow: 0, flexShrink: 0 }}>
          <Teleprompter initialWpm={props.settings.teleprompter_wpm} />
        </div>
        <DragHandle
          onDrag={(delta) =>
            setWidths((prev) => resize(prev, 0, delta))
          }
        />
        <div className="relative flex min-h-0 flex-1 flex-col" style={{ flexBasis: `${widths[1]}%` }}>
          {current && mirror ? (
            <>
              <AudienceMirror
                slide={current}
                beat={mirror.beatIndex}
                theme={current.theme}
                imageUrl={current.generatedImageUrl || current.imageUrl}
                imageAttribution={current.imageAttribution}
                revealLineCount={mirror.revealLineCount}
                showChrome
              />
              <SyncDebugDot role="host" />
            </>
          ) : null}
          <div className="pointer-events-none absolute left-4 top-4 text-[11px] uppercase tracking-[0.16em] text-ivory/70">
            Slide {index + 1} / {assignments.length}
          </div>
          <div
            className="pointer-events-none absolute left-4 top-9 text-[11px] uppercase tracking-[0.16em] text-ivory/55"
            data-image-status={hostImageStatus(current)}
          >
            image: {hostImageStatus(current)}
          </div>
          <div className="pointer-events-none absolute right-4 top-4 font-mono text-[11px] text-ivory/70">
            {formatClock(totalElapsed)}
          </div>
          {gridOpen ? <SlideGrid onClose={() => setGridOpen(false)} /> : null}
        </div>
        <DragHandle
          onDrag={(delta) => setWidths((prev) => resize(prev, 1, delta))}
        />
        <div className="h-48 lg:h-full" style={{ flexBasis: `${widths[2]}%`, flexGrow: 0, flexShrink: 0 }}>
          <NextUpPanel
            totalElapsed={totalElapsed}
            slideElapsed={slideElapsed}
            audienceCount={audienceCount}
            connected={connection === "connected"}
            wpm={props.settings.teleprompter_wpm}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#071018] px-3 py-2">
        <Button type="button" size="sm" variant="outline" onClick={() => dispatch({ type: "PREV" })}>
          Prev
        </Button>
        <Button type="button" size="sm" onClick={() => dispatch({ type: "NEXT" })}>
          Next
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => dispatch({ type: "BEAT", direction: 1 })}>
          Beat (B)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={imageBusy || !current}
          onClick={() => void generateCurrentImage()}
        >
          {imageBusy ? "Image…" : "Image (I)"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setGridOpen(true)}>
          Jump-to-grid
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => dispatch({ type: scrolling ? "PAUSE" : "RESUME" })}
        >
          {scrolling ? "Pause" : "Resume"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => toggleRehearsalMode()}>
          {rehearsal ? "Exit rehearsal" : "Rehearsal"}
        </Button>
        {rehearsal ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setReshuffleError(null);
              void reshuffleLiveRunAction({ classId: props.classId, runId: props.runPk }).then(
                (result) => {
                  if (!result.ok) {
                    setReshuffleError(result.error);
                    return;
                  }
                  dispatch({ type: "SET_ASSIGNMENTS", assignments: result.slides });
                },
              );
            }}
          >
            Shuffle theme
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="destructive" onClick={() => setEndOpen(true)}>
          End
        </Button>
        <span className="ml-auto truncate text-[11px] text-ivory/40">{props.classTitle}</span>
        <a
          href={audienceHref}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-gold underline-offset-4 hover:underline"
        >
          Audience link
        </a>
      </div>
      {reshuffleError ? (
        <p className="bg-red-500/15 px-3 py-1 text-xs text-red-200">{reshuffleError}</p>
      ) : null}

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this run?</DialogTitle>
            <DialogDescription>
              The audience will see a thank-you screen. You can start a new run from Present setup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEndOpen(false)}>
              Keep presenting
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                dispatch({ type: "END" });
                void endPresentationAction({
                  classId: props.classId,
                  runId: props.runPk,
                  peakAudience,
                  slidesAdvanced,
                  slideIndex: index,
                });
                setEndOpen(false);
              }}
            >
              End run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function hostImageStatus(slide: SlideAssignment | null) {
  if (!slide) return "none";
  if (slide.imageStatus === "generating" || slide.imageStatus === "queued") return "generating";
  if (slide.generatedImageUrl || slide.imageUrl || slide.imageStatus === "ready") return "ready";
  return "none";
}

function DragHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  return (
    <button
      type="button"
      aria-label="Resize columns"
      className="hidden w-1.5 cursor-col-resize bg-white/10 hover:bg-gold/60 lg:block"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const width = event.currentTarget.parentElement?.clientWidth ?? 1;
        const move = (next: PointerEvent) => {
          onDrag(((next.clientX - lastX) / width) * 100);
          lastX = next.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}

function resize(widths: number[], handle: number, delta: number) {
  const next = [...widths];
  const change = Math.max(-next[handle] + 18, Math.min(next[handle + 1] - 16, delta));
  next[handle] += change;
  next[handle + 1] -= change;
  return next;
}
