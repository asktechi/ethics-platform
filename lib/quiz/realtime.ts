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
    type === "SKIP" ||
    type === "END" ||
    type === "HIGHLIGHT" ||
    type === "CASE_INTRO" ||
    type === "CASE_COMPLETE" ||
    type === "ADAPTIVE_START" ||
    type === "ADAPTIVE_PROGRESS"
  );
}

export function wrapHostEvent(event: QuizEvent, hostId: string, hostToken: string): QuizEvent {
  return { ...event, sender: hostId, host_token: hostToken };
}

export function isTrustedHostEvent(
  event: QuizEvent,
  expectedHostId?: string | null,
  expectedToken?: string | null,
) {
  if (expectedHostId && event.sender && event.sender !== expectedHostId) return false;
  if (expectedToken && event.host_token && event.host_token !== expectedToken) return false;
  if (expectedHostId && !event.sender) return false;
  if (expectedToken && !event.host_token) return false;
  return true;
}

export function hostConnect(
  client: SupabaseClient,
  sessionId: string,
  opts: {
    snapshot?: () => QuizEvent | null;
    hostId: string;
    hostToken: string;
  },
) {
  const channel = client.channel(quizChannelName(sessionId), {
    config: { broadcast: { ack: true, self: false }, presence: { key: `host:${opts.hostId}` } },
  });
  let lastEvent: QuizEvent | null = null;

  channel.on("broadcast", { event: REQUEST_SNAPSHOT }, () => {
    const event = opts.snapshot?.() ?? lastEvent;
    if (event) {
      void channel.send({
        type: "broadcast",
        event: CHANNEL_EVENT,
        payload: wrapHostEvent(event, opts.hostId, opts.hostToken),
      });
    }
  });

  const unsubscribe = subscribe((event, _state, origin) => {
    if (origin !== "local") return;
    if (event.type === "HYDRATE") return;
    lastEvent = event;
    void channel.send({
      type: "broadcast",
      event: CHANNEL_EVENT,
      payload: wrapHostEvent(event, opts.hostId, opts.hostToken),
    });
  });

  const ready = new Promise<RealtimeChannel>((resolve) => {
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ role: "host", host_id: opts.hostId, at: Date.now() });
        resolve(channel);
      }
    });
  });

  return {
    channel,
    ready,
    publish(event: QuizEvent) {
      lastEvent = event;
      return channel.send({
        type: "broadcast",
        event: CHANNEL_EVENT,
        payload: wrapHostEvent(event, opts.hostId, opts.hostToken),
      });
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
  auth?: { hostId?: string | null; hostToken?: string | null; participantId?: string },
) {
  const channel = client.channel(quizChannelName(sessionId), {
    config: {
      broadcast: { ack: true, self: true },
      presence: { key: auth?.participantId ?? "player" },
    },
  });

  channel.on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => {
    if (!isQuizEvent(payload)) return;
    if (!isTrustedHostEvent(payload, auth?.hostId, auth?.hostToken)) return;
    applyRemoteEvent(payload);
    onEvent(payload);
  });

  const ready = new Promise<RealtimeChannel>((resolve) => {
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (auth?.participantId) {
          void channel.track({ role: "player", participant_id: auth.participantId, at: Date.now() });
        }
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
