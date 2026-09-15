import type { PresentationBusState, SyncFingerprint } from "@/lib/presentation/types";

export function fingerprintOf(state: Pick<
  PresentationBusState,
  "currentSlideIndex" | "currentBeatIndex" | "teleprompterLineIndex" | "isPaused"
>): SyncFingerprint {
  return {
    slideIndex: state.currentSlideIndex,
    beatIndex: state.currentBeatIndex,
    lineIndex: state.teleprompterLineIndex,
    isPaused: state.isPaused,
  };
}

export function fingerprintsEqual(a: SyncFingerprint | null, b: SyncFingerprint | null) {
  if (!a || !b) return false;
  return (
    a.slideIndex === b.slideIndex &&
    a.beatIndex === b.beatIndex &&
    a.lineIndex === b.lineIndex &&
    a.isPaused === b.isPaused
  );
}

export type SyncDotStatus = "green" | "yellow" | "red";

const YELLOW_MS = 1200;
const RED_MS = 2500;

let lastRemote: SyncFingerprint | null = null;
let lastRemoteAt = 0;
let lastAck: SyncFingerprint | null = null;
let lastAckAt = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeSyncDebug(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordRemoteFingerprint(fp: SyncFingerprint) {
  lastRemote = fp;
  lastRemoteAt = Date.now();
  notify();
}

export function recordAudienceAck(fp: SyncFingerprint) {
  lastAck = fp;
  lastAckAt = Date.now();
  notify();
}

export function readSyncDebug() {
  return { lastRemote, lastRemoteAt, lastAck, lastAckAt };
}

export function evaluateSyncDot(options: {
  role: "host" | "audience";
  local: SyncFingerprint;
  now?: number;
}): { status: SyncDotStatus; mismatch: boolean } {
  const now = options.now ?? Date.now();
  const peer = options.role === "host" ? lastAck : lastRemote;
  const peerAt = options.role === "host" ? lastAckAt : lastRemoteAt;
  if (!peer) {
    if (!peerAt) return { status: "yellow", mismatch: true };
    return { status: now - peerAt > RED_MS ? "red" : "yellow", mismatch: true };
  }
  if (fingerprintsEqual(options.local, peer)) {
    return { status: "green", mismatch: false };
  }
  const age = now - peerAt;
  if (age < YELLOW_MS) return { status: "yellow", mismatch: true };
  return { status: "red", mismatch: true };
}
