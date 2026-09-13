"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { applyRemoteEvent, getQuizState, subscribe } from "@/lib/quiz/bus";
import type { QuizEvent } from "@/lib/quiz/types";

const CHANNEL_EVENT = "quiz";
const REQUEST_SNAPSHOT = "request_snapshot";

export function quizChannelName(sessionId: string) {
  return `quiz:${sessionId}`;
}

function isQuizEvent(value: unknown): value is QuizEvent {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: string }).type;
  return (
    type === "QUESTION" ||
    type === "REVEAL" ||
    type === "NEXT" ||
    type === "PREV" ||
    type === "PAUSE" ||
    type === "RESUME" ||
    type === "END"
  );
}

export function hostConnect(
  client: SupabaseClient,
  sessionId: string,
  snapshot?: () => QuizEvent | null,
) {
  const channel = client.channel(quizChannelName(sessionId), {
    config: { broadcast: { ack: true, self: false } },
  });
  let lastEvent: QuizEvent | null = null;

  channel.on("broadcast", { event: REQUEST_SNAPSHOT }, () => {
    const event = snapshot?.() ?? lastEvent;
    if (event) {
      void channel.send({ type: "broadcast", event: CHANNEL_EVENT, payload: event });
    }
  });

  const unsubscribe = subscribe((event, _state, origin) => {
    if (origin !== "local") return;
    if (event.type === "HYDRATE") return;
    lastEvent = event;
    void channel.send({ type: "broadcast", event: CHANNEL_EVENT, payload: event });
  });

  const ready = new Promise<RealtimeChannel>((resolve) => {
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve(channel);
    });
  });

  return {
    channel,
    ready,
    publish(event: QuizEvent) {
      return channel.send({ type: "broadcast", event: CHANNEL_EVENT, payload: event });
    },
    disconnect() {
      unsubscribe();
      void client.removeChannel(channel);
    },
  };
}

export function playerConnect(
  client: SupabaseClient,
  sessionId: string,
  onEvent: (event: QuizEvent) => void,
) {
  const channel = client.channel(quizChannelName(sessionId), {
    config: { broadcast: { ack: true, self: true } },
  });

  channel.on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => {
    if (!isQuizEvent(payload)) return;
    applyRemoteEvent(payload);
    onEvent(payload);
  });

  const ready = new Promise<RealtimeChannel>((resolve) => {
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.send({
          type: "broadcast",
          event: REQUEST_SNAPSHOT,
          payload: { ts: Date.now() },
        });
        resolve(channel);
      }
    });
  });

  return {
    channel,
    ready,
    disconnect() {
      void client.removeChannel(channel);
    },
  };
}

export function currentHostSnapshot(): QuizEvent | null {
  const state = getQuizState();
  if (state.ended) return { type: "END" };
  return null;
}
