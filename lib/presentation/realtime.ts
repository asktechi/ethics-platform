"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  applyRemoteEvent,
  applyRemoteIndex,
  getPresentationState,
  subscribe,
} from "@/lib/presentation/bus";
import { fingerprintOf, recordAudienceAck, recordRemoteFingerprint } from "@/lib/presentation/sync";
import type {
  BusEventType,
  ConnectionStatus,
  RealtimeEnvelope,
  SyncFingerprint,
} from "@/lib/presentation/types";

const CHANNEL_EVENT = "state";
const SNAPSHOT_EVENT = "snapshot";
const RESYNC_EVENT = "resync";
const REQUEST_SNAPSHOT_EVENT = "request_snapshot";
const SYNC_ACK_EVENT = "sync_ack";

export function presentationChannelName(runId: string) {
  return `presentation:${runId}`;
}

function isBusEventType(value: string): value is BusEventType {
  return (
    value === "NEXT" ||
    value === "PREV" ||
    value === "GOTO" ||
    value === "PAUSE" ||
    value === "RESUME" ||
    value === "END" ||
    value === "TELEPROMPTER_LINE" ||
    value === "BEAT" ||
    value === "RESYNC"
  );
}

function snapshotEnvelope(type: "SNAPSHOT" | "RESYNC" = "SNAPSHOT"): RealtimeEnvelope {
  const state = getPresentationState();
  return {
    type,
    slideIndex: state.currentSlideIndex,
    lineIndex: state.teleprompterLineIndex,
    beatIndex: state.currentBeatIndex,
    ts: Date.now(),
    ended: state.ended,
    isPaused: state.isPaused,
    teleprompterScrolling: state.teleprompterScrolling,
    revealAll: state.revealFlushed,
  };
}

function rememberHost(payload: RealtimeEnvelope, extras?: Partial<SyncFingerprint>) {
  const current = getPresentationState();
  recordRemoteFingerprint({
    slideIndex: payload.slideIndex,
    beatIndex: extras?.beatIndex ?? payload.beatIndex ?? current.currentBeatIndex,
    lineIndex: extras?.lineIndex ?? payload.lineIndex ?? current.teleprompterLineIndex,
    isPaused: extras?.isPaused ?? payload.isPaused ?? current.isPaused,
  });
}

function applyEnvelope(payload: RealtimeEnvelope, scheduleAdvance: (fn: () => void) => void) {
  if (payload.type === "SNAPSHOT" || payload.type === "RESYNC") {
    applyRemoteEvent({
      type: "RESYNC",
      slideIndex: payload.slideIndex,
      beatIndex: payload.beatIndex ?? 0,
      lineIndex: payload.lineIndex ?? -1,
      isPaused: payload.isPaused ?? false,
      ended: payload.ended,
      teleprompterScrolling: payload.teleprompterScrolling,
      revealAll: payload.revealAll,
    });
    if (typeof payload.lineIndex === "number") {
      applyRemoteEvent({
        type: "SET_TELEPROMPTER_LINE",
        slideIndex: payload.slideIndex,
        lineIndex: payload.lineIndex,
      });
    }
    if (payload.ended) applyRemoteEvent({ type: "END" });
    rememberHost(payload, fingerprintOf(getPresentationState()));
    return;
  }
  if (payload.type === "END") {
    applyRemoteIndex(payload.slideIndex, { ended: true });
    applyRemoteEvent({ type: "END" });
    rememberHost(payload, { isPaused: true });
    return;
  }
  if (payload.type === "PAUSE") {
    applyRemoteIndex(payload.slideIndex, {
      isPaused: true,
      lineIndex: payload.lineIndex ?? getPresentationState().teleprompterLineIndex,
      beatIndex: payload.beatIndex,
      teleprompterScrolling: false,
    });
    applyRemoteEvent({ type: "PAUSE" });
    rememberHost(payload, { isPaused: true });
    return;
  }
  if (payload.type === "RESUME") {
    applyRemoteIndex(payload.slideIndex, {
      isPaused: false,
      lineIndex: payload.lineIndex ?? getPresentationState().teleprompterLineIndex,
      beatIndex: payload.beatIndex,
      teleprompterScrolling: true,
    });
    applyRemoteEvent({ type: "RESUME" });
    rememberHost(payload, { isPaused: false });
    return;
  }
  if (payload.type === "TELEPROMPTER_LINE") {
    const state = getPresentationState();
    if (state.isPaused) return;
    const lineIndex = payload.lineIndex ?? 0;
    applyRemoteEvent({
      type: "SET_TELEPROMPTER_LINE",
      slideIndex: payload.slideIndex,
      lineIndex,
    });
    rememberHost(payload, fingerprintOf(getPresentationState()));
    return;
  }
  if (payload.type === "BEAT") {
    applyRemoteEvent({
      type: "BEAT",
      slideIndex: payload.slideIndex,
      beatIndex: payload.beatIndex ?? 0,
    });
    rememberHost(payload, fingerprintOf(getPresentationState()));
    return;
  }
  if (payload.type === "NEXT") {
    applyRemoteEvent({ type: "SET_REVEAL_FLUSH", flushed: true });
    scheduleAdvance(() => {
      applyRemoteIndex(payload.slideIndex, {
        ended: false,
        lineIndex: -1,
        revealAll: false,
        beatIndex: payload.beatIndex ?? 0,
      });
      rememberHost(payload, fingerprintOf(getPresentationState()));
    });
    return;
  }
  if (payload.type === "PREV") {
    applyRemoteEvent({ type: "PREV" });
    applyRemoteIndex(payload.slideIndex, {
      ended: false,
      lineIndex: payload.lineIndex ?? getPresentationState().teleprompterLineIndex,
      beatIndex: payload.beatIndex ?? getPresentationState().currentBeatIndex,
    });
    rememberHost(payload, fingerprintOf(getPresentationState()));
    return;
  }
  applyRemoteIndex(payload.slideIndex, {
    ended: false,
    lineIndex: payload.lineIndex ?? -1,
    beatIndex: payload.beatIndex,
  });
  rememberHost(payload, fingerprintOf(getPresentationState()));
}

export type PresentationRealtimeHandle = {
  disconnect: () => void;
  requestSnapshot: () => void;
  broadcastSnapshot: () => void;
  broadcastResync: () => void;
};

export function connectPresentationRealtime(options: {
  supabase: SupabaseClient;
  runId: string;
  role: "host" | "audience";
  onPresence?: (count: number, audienceCount: number) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
}): PresentationRealtimeHandle {
  const { supabase, runId, role } = options;
  const name = presentationChannelName(runId);
  let channel: RealtimeChannel | null = null;
  let unsubBus: (() => void) | null = null;
  let disposed = false;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;

  const send = (event: string, payload: RealtimeEnvelope | SyncFingerprint | Record<string, never>) => {
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event,
      payload,
    });
  };

  const broadcastSnapshot = () => {
    if (role !== "host") return;
    if (getPresentationState().mode === "rehearsal") {
      console.log("[presentation] rehearsal — not broadcasting SNAPSHOT");
      return;
    }
    send(SNAPSHOT_EVENT, snapshotEnvelope("SNAPSHOT"));
  };

  const broadcastResync = () => {
    if (role !== "host") return;
    if (getPresentationState().mode === "rehearsal") {
      console.log("[presentation] rehearsal — not broadcasting RESYNC");
      return;
    }
    send(RESYNC_EVENT, snapshotEnvelope("RESYNC"));
    send(SNAPSHOT_EVENT, snapshotEnvelope("SNAPSHOT"));
  };

  const publish = (type: BusEventType | "SNAPSHOT" | "RESYNC") => {
    const state = getPresentationState();
    if (state.mode === "rehearsal") {
      console.log("[presentation] rehearsal — not broadcasting", type);
      return;
    }
    if (state.mode !== "host") return;
    const payload = snapshotEnvelope(type === "RESYNC" ? "RESYNC" : type === "SNAPSHOT" ? "SNAPSHOT" : "SNAPSHOT");
    payload.type = type;
    if (type === "NEXT") payload.revealAll = true;
    const eventName = type === "SNAPSHOT" ? SNAPSHOT_EVENT : type === "RESYNC" ? RESYNC_EVENT : CHANNEL_EVENT;
    send(eventName, payload);
  };

  options.onConnectionChange?.("connecting");

  channel = supabase.channel(name, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: `${role}:${crypto.randomUUID()}` },
    },
  });

  const scheduleAdvance = (fn: () => void) => {
    if (advanceTimer) window.clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      if (!disposed) fn();
    }, 200);
  };

  const ackLocalState = () => {
    if (role !== "audience") return;
    send(SYNC_ACK_EVENT, fingerprintOf(getPresentationState()));
  };

  if (role === "audience") {
    channel.on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => {
      const envelope = payload as RealtimeEnvelope;
      if (!envelope || typeof envelope.slideIndex !== "number") return;
      applyEnvelope(envelope, scheduleAdvance);
      ackLocalState();
    });
    channel.on("broadcast", { event: SNAPSHOT_EVENT }, ({ payload }) => {
      const envelope = payload as RealtimeEnvelope;
      if (!envelope || typeof envelope.slideIndex !== "number") return;
      applyEnvelope({ ...envelope, type: "SNAPSHOT" }, scheduleAdvance);
      ackLocalState();
    });
    channel.on("broadcast", { event: RESYNC_EVENT }, ({ payload }) => {
      const envelope = payload as RealtimeEnvelope;
      if (!envelope || typeof envelope.slideIndex !== "number") return;
      applyEnvelope({ ...envelope, type: "RESYNC" }, scheduleAdvance);
      ackLocalState();
    });
  }

  if (role === "host") {
    channel.on("broadcast", { event: REQUEST_SNAPSHOT_EVENT }, () => {
      broadcastResync();
    });
    channel.on("broadcast", { event: SYNC_ACK_EVENT }, ({ payload }) => {
      const ack = payload as SyncFingerprint;
      if (!ack || typeof ack.slideIndex !== "number") return;
      recordAudienceAck(ack);
    });
    let lastBeatIndex = getPresentationState().currentBeatIndex;
    unsubBus = subscribe((event, state, origin) => {
      if (origin !== "local") return;
      if (
        event.type === "NEXT" ||
        event.type === "PREV" ||
        event.type === "GOTO" ||
        event.type === "PAUSE" ||
        event.type === "RESUME" ||
        event.type === "END" ||
        event.type === "TELEPROMPTER_LINE" ||
        event.type === "BEAT" ||
        event.type === "RESYNC"
      ) {
        publish(event.type);
        if (event.type === "TELEPROMPTER_LINE" && state.currentBeatIndex !== lastBeatIndex) {
          publish("BEAT");
        }
        lastBeatIndex = state.currentBeatIndex;
      }
    });
  }

  channel.on("presence", { event: "sync" }, () => {
    if (!channel) return;
    const state = channel.presenceState() as Record<string, Array<{ role?: string }>>;
    const people = Object.values(state).flat();
    const audienceCount = people.filter((entry) => entry.role === "audience").length;
    options.onPresence?.(people.length, audienceCount);
  });

  channel.subscribe(async (status) => {
    if (disposed) return;
    if (status === "SUBSCRIBED") {
      options.onConnectionChange?.("connected");
      await channel?.track({ role, at: Date.now() });
      if (role === "host") {
        broadcastResync();
      } else {
        send(REQUEST_SNAPSHOT_EVENT, {});
      }
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      options.onConnectionChange?.("disconnected");
    }
  });

  return {
    disconnect: () => {
      disposed = true;
      if (advanceTimer) window.clearTimeout(advanceTimer);
      unsubBus?.();
      unsubBus = null;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    },
    requestSnapshot: () => send(REQUEST_SNAPSHOT_EVENT, {}),
    broadcastSnapshot,
    broadcastResync,
  };
}

export function isPublishableEvent(type: string): type is BusEventType {
  return isBusEventType(type);
}
