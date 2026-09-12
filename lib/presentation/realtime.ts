"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  applyRemoteEvent,
  applyRemoteIndex,
  getPresentationState,
  subscribe,
} from "@/lib/presentation/bus";
import type {
  BusEventType,
  ConnectionStatus,
  RealtimeEnvelope,
} from "@/lib/presentation/types";

const CHANNEL_EVENT = "state";
const SNAPSHOT_EVENT = "snapshot";
const REQUEST_SNAPSHOT_EVENT = "request_snapshot";

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
    value === "END"
  );
}

function snapshotEnvelope(): RealtimeEnvelope {
  const state = getPresentationState();
  return {
    type: "SNAPSHOT",
    slideIndex: state.currentSlideIndex,
    ts: Date.now(),
    ended: state.ended,
    isPaused: state.isPaused,
    teleprompterScrolling: state.teleprompterScrolling,
  };
}

function applyEnvelope(payload: RealtimeEnvelope) {
  if (payload.type === "SNAPSHOT") {
    applyRemoteIndex(payload.slideIndex, {
      ended: payload.ended,
      isPaused: payload.isPaused,
    });
    if (payload.ended) applyRemoteEvent({ type: "END" });
    return;
  }
  if (payload.type === "END") {
    applyRemoteIndex(payload.slideIndex, { ended: true });
    applyRemoteEvent({ type: "END" });
    return;
  }
  if (payload.type === "PAUSE") {
    applyRemoteIndex(payload.slideIndex, { isPaused: true });
    applyRemoteEvent({ type: "PAUSE" });
    return;
  }
  if (payload.type === "RESUME") {
    applyRemoteIndex(payload.slideIndex, { isPaused: false });
    applyRemoteEvent({ type: "RESUME" });
    return;
  }
  applyRemoteIndex(payload.slideIndex, { ended: false });
}

export type PresentationRealtimeHandle = {
  disconnect: () => void;
  requestSnapshot: () => void;
  broadcastSnapshot: () => void;
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

  const send = (event: string, payload: RealtimeEnvelope | Record<string, never>) => {
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
    send(SNAPSHOT_EVENT, snapshotEnvelope());
  };

  const publish = (type: BusEventType | "SNAPSHOT") => {
    const state = getPresentationState();
    if (state.mode === "rehearsal") {
      // Phase 4.9: rehearsal must never hit the Realtime channel.
      console.log("[presentation] rehearsal — not broadcasting", type);
      return;
    }
    if (state.mode !== "host") return;
    const payload: RealtimeEnvelope = {
      type,
      slideIndex: state.currentSlideIndex,
      ts: Date.now(),
      ended: state.ended,
      isPaused: state.isPaused,
      teleprompterScrolling: state.teleprompterScrolling,
    };
    send(type === "SNAPSHOT" ? SNAPSHOT_EVENT : CHANNEL_EVENT, payload);
  };

  options.onConnectionChange?.("connecting");

  channel = supabase.channel(name, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: `${role}:${crypto.randomUUID()}` },
    },
  });

  if (role === "audience") {
    channel.on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => {
      const envelope = payload as RealtimeEnvelope;
      if (!envelope || typeof envelope.slideIndex !== "number") return;
      applyEnvelope(envelope);
    });
    channel.on("broadcast", { event: SNAPSHOT_EVENT }, ({ payload }) => {
      const envelope = payload as RealtimeEnvelope;
      if (!envelope || typeof envelope.slideIndex !== "number") return;
      applyEnvelope({ ...envelope, type: "SNAPSHOT" });
    });
  }

  if (role === "host") {
    channel.on("broadcast", { event: REQUEST_SNAPSHOT_EVENT }, () => {
      broadcastSnapshot();
    });
    unsubBus = subscribe((event, _state, origin) => {
      if (origin !== "local") return;
      if (
        event.type === "NEXT" ||
        event.type === "PREV" ||
        event.type === "GOTO" ||
        event.type === "PAUSE" ||
        event.type === "RESUME" ||
        event.type === "END"
      ) {
        publish(event.type);
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
        // Reconnect contract: host republishes a full snapshot so late joiners lockstep.
        broadcastSnapshot();
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
      unsubBus?.();
      unsubBus = null;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    },
    requestSnapshot: () => send(REQUEST_SNAPSHOT_EVENT, {}),
    broadcastSnapshot,
  };
}

export function isPublishableEvent(type: string): type is BusEventType {
  return isBusEventType(type);
}
