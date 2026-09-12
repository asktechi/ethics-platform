"use client";

import { create } from "zustand";
import type {
  BusEvent,
  EventOrigin,
  PresentationBusState,
  PresentationMode,
  SlideAssignment,
} from "@/lib/presentation/types";

export type BusListener = (
  event: BusEvent,
  state: PresentationBusState,
  origin: EventOrigin,
) => void;

const initialState: PresentationBusState = {
  currentSlideIndex: 0,
  isPaused: false,
  teleprompterScrolling: true,
  teleprompterLineIndex: -1,
  revealFlushed: false,
  mode: "host",
  runId: null,
  assignments: [],
  slideCount: 0,
  ended: false,
  slidesAdvanced: 0,
  peakAudience: 0,
};

const listeners = new Set<BusListener>();

function clampIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index));
}

function reduce(state: PresentationBusState, event: BusEvent): PresentationBusState {
  switch (event.type) {
    case "NEXT": {
      if (state.ended || state.slideCount === 0) return state;
      const next = clampIndex(state.currentSlideIndex + 1, state.slideCount);
      if (next === state.currentSlideIndex) return state;
      return {
        ...state,
        currentSlideIndex: next,
        slidesAdvanced: state.slidesAdvanced + 1,
        teleprompterLineIndex: -1,
        revealFlushed: true,
      };
    }
    case "PREV": {
      if (state.ended || state.slideCount === 0) return state;
      return {
        ...state,
        currentSlideIndex: clampIndex(state.currentSlideIndex - 1, state.slideCount),
        teleprompterLineIndex: -1,
        revealFlushed: false,
      };
    }
    case "GOTO": {
      if (state.ended || state.slideCount === 0) return state;
      const next = clampIndex(event.index, state.slideCount);
      if (next === state.currentSlideIndex) return state;
      return {
        ...state,
        currentSlideIndex: next,
        slidesAdvanced: state.slidesAdvanced + 1,
        teleprompterLineIndex: -1,
        revealFlushed: false,
      };
    }
    case "TELEPROMPTER_LINE":
    case "SET_TELEPROMPTER_LINE": {
      if (state.isPaused && event.lineIndex > state.teleprompterLineIndex) {
        return state;
      }
      return {
        ...state,
        currentSlideIndex: clampIndex(event.slideIndex, state.slideCount || event.slideIndex + 1),
        teleprompterLineIndex: event.lineIndex,
        revealFlushed: false,
      };
    }
    case "SET_REVEAL_FLUSH":
      return {
        ...state,
        revealFlushed: event.flushed,
        teleprompterLineIndex: event.flushed
          ? Number.MAX_SAFE_INTEGER
          : state.teleprompterLineIndex,
      };
    case "PAUSE":
      return { ...state, isPaused: true, teleprompterScrolling: false };
    case "RESUME":
      return { ...state, isPaused: false, teleprompterScrolling: true };
    case "END":
      return {
        ...state,
        ended: true,
        isPaused: true,
        teleprompterScrolling: false,
      };
    case "SET_MODE":
      return { ...state, mode: event.mode };
    case "SET_ASSIGNMENTS":
      return {
        ...state,
        assignments: event.assignments,
        slideCount: event.assignments.length,
        currentSlideIndex: clampIndex(state.currentSlideIndex, event.assignments.length),
      };
    case "SET_PEAK_AUDIENCE":
      return { ...state, peakAudience: Math.max(state.peakAudience, event.count) };
    case "HYDRATE":
      return {
        ...state,
        ...event.state,
        slideCount: event.state.assignments?.length ?? event.state.slideCount ?? state.slideCount,
        currentSlideIndex: clampIndex(
          event.state.currentSlideIndex ?? state.currentSlideIndex,
          event.state.assignments?.length ?? event.state.slideCount ?? state.slideCount,
        ),
      };
    default:
      return state;
  }
}

function emit(event: BusEvent, state: PresentationBusState, origin: EventOrigin) {
  for (const listener of listeners) {
    listener(event, state, origin);
  }
}

type BusStore = PresentationBusState & {
  dispatch: (event: BusEvent) => void;
  applyRemoteEvent: (event: BusEvent) => void;
  applyRemoteIndex: (
    index: number,
    extras?: { ended?: boolean; isPaused?: boolean; lineIndex?: number; revealAll?: boolean },
  ) => void;
};

export const usePresentationBus = create<BusStore>((set, get) => ({
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
  applyRemoteIndex: (index, extras) => {
    const current = get();
    const slideChanged = clampIndex(index, current.slideCount) !== current.currentSlideIndex;
    const next: PresentationBusState = {
      ...current,
      currentSlideIndex: clampIndex(index, current.slideCount),
      ended: extras?.ended ?? current.ended,
      isPaused: extras?.isPaused ?? current.isPaused,
      teleprompterScrolling: extras?.isPaused === true ? false : current.teleprompterScrolling,
      teleprompterLineIndex: extras?.lineIndex ?? (slideChanged ? -1 : current.teleprompterLineIndex),
      revealFlushed: extras?.revealAll ?? current.revealFlushed,
    };
    set(next);
    emit({ type: "GOTO", index: next.currentSlideIndex }, next, "remote");
  },
}));

/**
 * Single entry point for every advance / back / jump / pause / end.
 * Phase 4.5 voice input must call this — never mutate the store from a component.
 *
 *   import { dispatch } from "@/lib/presentation/bus"
 *   dispatch({ type: "NEXT" })
 */
export function dispatch(event: BusEvent) {
  usePresentationBus.getState().dispatch(event);
}

export function applyRemoteEvent(event: BusEvent) {
  usePresentationBus.getState().applyRemoteEvent(event);
}

export function applyRemoteIndex(
  index: number,
  extras?: { ended?: boolean; isPaused?: boolean; lineIndex?: number; revealAll?: boolean },
) {
  usePresentationBus.getState().applyRemoteIndex(index, extras);
}

export function subscribe(listener: BusListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPresentationState() {
  return usePresentationBus.getState();
}

export function resetPresentationBus() {
  usePresentationBus.setState({
    currentSlideIndex: 0,
    isPaused: false,
    teleprompterScrolling: true,
    teleprompterLineIndex: -1,
    revealFlushed: false,
    mode: "host",
    runId: null,
    assignments: [],
    slideCount: 0,
    ended: false,
    slidesAdvanced: 0,
    peakAudience: 0,
  });
}

export function currentAssignment(): SlideAssignment | null {
  const state = usePresentationBus.getState();
  return state.assignments[state.currentSlideIndex] ?? null;
}

export function toggleRehearsalMode() {
  const { mode } = usePresentationBus.getState();
  const next: PresentationMode = mode === "rehearsal" ? "host" : "rehearsal";
  dispatch({ type: "SET_MODE", mode: next });
  return next;
}
