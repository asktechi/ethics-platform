"use client";

import { useEffect, useState } from "react";
import { evaluateSyncDot, fingerprintOf, subscribeSyncDebug } from "@/lib/presentation/sync";
import { usePresentationBus } from "@/lib/presentation/bus";

const COLORS = {
  green: "#34d399",
  yellow: "#fbbf24",
  red: "#f87171",
};

export function SyncDebugDot({ role }: { role: "host" | "audience" }) {
  const [enabled, setEnabled] = useState(false);
  const [tick, setTick] = useState(0);
  const slideIndex = usePresentationBus((s) => s.currentSlideIndex);
  const beatIndex = usePresentationBus((s) => s.currentBeatIndex);
  const lineIndex = usePresentationBus((s) => s.teleprompterLineIndex);
  const isPaused = usePresentationBus((s) => s.isPaused);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("sync") === "debug");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const unsub = subscribeSyncDebug(() => setTick((value) => value + 1));
    const timer = window.setInterval(() => setTick((value) => value + 1), 400);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled) return null;

  const local = fingerprintOf({
    currentSlideIndex: slideIndex,
    currentBeatIndex: beatIndex,
    teleprompterLineIndex: lineIndex,
    isPaused,
  });
  const { status, mismatch } = evaluateSyncDot({ role, local });

  if (status === "red" && mismatch) {
    console.error("[presentation] sync mismatch", { role, local, tick });
  }

  return (
    <div
      data-sync-debug={status}
      className="pointer-events-none absolute right-3 top-3 z-50 flex items-center gap-2 rounded-full bg-black/55 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-ivory/80"
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: COLORS[status] }}
        aria-label={`sync ${status}`}
      />
      {status}
    </div>
  );
}
