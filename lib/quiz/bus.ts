"use client";

import { create } from "zustand";
import type { QuizBusState, QuizEvent, QuizEventOrigin } from "@/lib/quiz/types";

export type QuizBusListener = (
  event: QuizEvent,
  state: QuizBusState,
  origin: QuizEventOrigin,
) => void;

const initialState: QuizBusState = {
  sessionId: null,
  questionIndex: 0,
  questionCount: 0,
  isPaused: false,
  ended: false,
  revealOpen: false,
  currentQuestionId: null,
};

const listeners = new Set<QuizBusListener>();

function clampIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index));
}

function reduce(state: QuizBusState, event: QuizEvent): QuizBusState {
  switch (event.type) {
    case "QUESTION":
      return {
        ...state,
        questionIndex: event.questionIndex,
        currentQuestionId: event.question_id,
        revealOpen: false,
        ended: false,
        isPaused: false,
      };
    case "REVEAL":
      return { ...state, revealOpen: true, currentQuestionId: event.question_id };
    case "NEXT": {
      if (state.ended || state.questionCount === 0) return state;
      const next = clampIndex(state.questionIndex + 1, state.questionCount);
      if (next === state.questionIndex) return state;
      return { ...state, questionIndex: next, revealOpen: false, currentQuestionId: null };
    }
    case "PREV": {
      if (state.ended || state.questionCount === 0) return state;
      const previous = clampIndex(state.questionIndex - 1, state.questionCount);
      if (previous === state.questionIndex) return state;
      return { ...state, questionIndex: previous, revealOpen: false, currentQuestionId: null };
    }
    case "PAUSE":
      return { ...state, isPaused: true };
    case "RESUME":
      return { ...state, isPaused: false };
    case "SKIP":
      return { ...state, revealOpen: false, currentQuestionId: event.question_id ?? state.currentQuestionId };
    case "HIGHLIGHT":
      return state;
    case "END":
      return { ...state, ended: true, isPaused: true, revealOpen: false };
    case "HYDRATE":
      return { ...state, ...event.state };
    default:
      return state;
  }
}

function emit(event: QuizEvent, state: QuizBusState, origin: QuizEventOrigin) {
  for (const listener of listeners) listener(event, state, origin);
}

type QuizStore = QuizBusState & {
  dispatch: (event: QuizEvent) => void;
  applyRemoteEvent: (event: QuizEvent) => void;
};

export const useQuizBus = create<QuizStore>((set, get) => ({
  ...initialState,
  dispatch: (event) => {
    const next = reduce(get(), event);
    set(next);
    emit(event, next, "local");
  },
  applyRemoteEvent: (event) => {
    const next = reduce(get(), event);
    set(next);
    emit(event, next, "remote");
  },
}));

/**
 * Single entry point for host question / reveal / next / end.
 * Phase 6 voice/replay must call this — never mutate the store from a component.
 */
export function dispatch(event: QuizEvent) {
  useQuizBus.getState().dispatch(event);
}

export function applyRemoteEvent(event: QuizEvent) {
  useQuizBus.getState().applyRemoteEvent(event);
}

export function subscribe(listener: QuizBusListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQuizState() {
  return useQuizBus.getState();
}

export function resetQuizBus(partial?: Partial<QuizBusState>) {
  useQuizBus.setState({ ...initialState, ...partial });
}
