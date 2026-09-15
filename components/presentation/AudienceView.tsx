"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { PresentationSkeleton, SessionStatusScreen } from "@/components/presentation/SessionStatusScreen";
import { SyncDebugDot } from "@/components/presentation/SyncDebugDot";
import { audienceMirrorModel } from "@/lib/presentation/mirror";
import {
  applyRemoteEvent,
  dispatch,
  resetPresentationBus,
  usePresentationBus,
} from "@/lib/presentation/bus";
import { prefetchUpcomingImages } from "@/lib/presentation/prefetch";
import { connectPresentationRealtime } from "@/lib/presentation/realtime";
import type { AudienceDeckResponse, ConnectionStatus } from "@/lib/presentation/types";
import { createClient } from "@/lib/supabase/client";

export function AudienceView({ runId }: { runId: string }) {
  const [payload, setPayload] = useState<AudienceDeckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");

  const index = usePresentationBus((s) => s.currentSlideIndex);
  const assignments = usePresentationBus((s) => s.assignments);
  const ended = usePresentationBus((s) => s.ended);
  const lineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const revealFlushed = usePresentationBus((s) => s.revealFlushed);
  const currentBeatIndex = usePresentationBus((s) => s.currentBeatIndex);
  const current = assignments[index] ?? null;

  useEffect(() => {
    let cancelled = false;
    resetPresentationBus();
    async function load() {
      try {
        const response = await fetch(`/api/present/${runId}`, { cache: "no-store" });
        const json = (await response.json()) as AudienceDeckResponse & { error?: string };
        if (cancelled) return;
        if (response.status === 404 || json.status === "not_found") {
          setPayload({ status: "not_found" });
          return;
        }
        if (!response.ok) {
          setError(json.error ?? "Could not load this session.");
          return;
        }
        setPayload(json);
        if (json.status === "live") {
          dispatch({
            type: "HYDRATE",
            state: {
              mode: "audience",
              runId,
              assignments: json.slides,
              slideCount: json.slides.length,
              currentSlideIndex: json.settings.current_slide_index,
              teleprompterLineIndex: -1,
              currentBeatIndex: 0,
              ended: false,
              teleprompterScrolling: false,
            },
          });
        }
        if (json.status === "ended") {
          applyRemoteEvent({ type: "END" });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load this session.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (payload?.status !== "live") return;
    const supabase = createClient();
    const handle = connectPresentationRealtime({
      supabase,
      runId,
      role: "audience",
      onConnectionChange: setConnection,
    });
    return () => handle.disconnect();
  }, [payload?.status, runId]);

  useEffect(() => {
    prefetchUpcomingImages(
      assignments.map((slide) => slide.imageUrl),
      index,
      1,
    );
  }, [assignments, index]);

  if (error) {
    return (
      <SessionStatusScreen
        tone="error"
        title="This session could not load"
        body={error}
      />
    );
  }

  if (!payload) {
    return <PresentationSkeleton label="Loading the live deck…" />;
  }

  if (payload.status === "not_found") {
    return (
      <SessionStatusScreen
        tone="error"
        title="Check the link with your instructor"
        body="That presentation run was not found. Ask for the current audience URL."
      />
    );
  }

  if (payload.status === "setup") {
    return (
      <SessionStatusScreen
        tone="waiting"
        title="Waiting for the presenter"
        body="The instructor has not gone live yet. Keep this tab open — the first slide will appear here."
      />
    );
  }

  if (payload.status === "ended" || ended) {
    return (
      <SessionStatusScreen
        tone="ended"
        title="Session ended — thank you"
        body="This session has ended. You can close the tab."
      />
    );
  }

  const allowAdvance = payload.status === "live" && payload.settings.allow_audience_advance;
  const revealMode =
    payload.status === "live" ? payload.settings.audience_reveal_mode : "progressive";
  const mirror = current
    ? audienceMirrorModel({
        slide: current,
        currentBeatIndex,
        teleprompterLineIndex: lineIndex,
        revealFlushed: revealFlushed || revealMode === "instant",
        revealMode,
      })
    : null;

  return (
    <main
      className="relative h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-navy"
      onClick={() => {
        if (allowAdvance) dispatch({ type: "NEXT" });
      }}
    >
      <AnimatePresence mode="wait">
        {current && mirror ? (
          <motion.div
            key={current.slideId}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <AudienceMirror
              slide={current}
              beat={mirror.beatIndex}
              theme={current.theme}
              imageUrl={current.generatedImageUrl || current.imageUrl}
              imageAttribution={current.imageAttribution}
              revealLineCount={mirror.revealLineCount}
              showChrome={false}
              fillViewport
            />
          </motion.div>
        ) : (
          <SessionStatusScreen
            tone="waiting"
            title="Waiting for the presenter"
            body="The live deck is empty. The first approved slide will appear here."
          />
        )}
      </AnimatePresence>
      {current ? (
        <p className="pointer-events-none absolute bottom-4 right-5 text-[11px] tracking-[0.18em] text-ivory/35">
          {index + 1}
        </p>
      ) : null}
      {connection !== "connected" ? (
        <div className="absolute left-1/2 top-5 z-20 -translate-x-1/2 bg-navy/80 px-4 py-1.5 text-xs text-ivory/80">
          Reconnecting…
        </div>
      ) : null}
      <SyncDebugDot role="audience" />
    </main>
  );
}
