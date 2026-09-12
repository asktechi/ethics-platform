import type { ThemePalette } from "@/lib/themes/types";

export type SlideLayout =
  | "hook"
  | "point"
  | "contrast"
  | "scenario"
  | "question"
  | "reveal"
  | "cue";

export type PresentationMode = "host" | "audience" | "rehearsal";

export type SlideAssignment = {
  slideId: string;
  title: string;
  body: string;
  cue: string | null;
  speakerNote: string | null;
  layout: SlideLayout;
  theme: ThemePalette;
  imageUrl: string | null;
  imageAttribution: string | null;
};

export type BusEventType = "NEXT" | "PREV" | "GOTO" | "PAUSE" | "RESUME" | "END";

export type BusEvent =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; index: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END" }
  | { type: "SET_MODE"; mode: PresentationMode }
  | { type: "SET_ASSIGNMENTS"; assignments: SlideAssignment[] }
  | { type: "SET_PEAK_AUDIENCE"; count: number }
  | {
      type: "HYDRATE";
      state: Partial<PresentationBusState>;
    };

export type EventOrigin = "local" | "remote";

export type PresentationBusState = {
  currentSlideIndex: number;
  isPaused: boolean;
  teleprompterScrolling: boolean;
  mode: PresentationMode;
  runId: string | null;
  assignments: SlideAssignment[];
  slideCount: number;
  ended: boolean;
  slidesAdvanced: number;
  peakAudience: number;
};

export type RealtimeEnvelope = {
  type: BusEventType | "SNAPSHOT";
  slideIndex: number;
  ts: number;
  ended?: boolean;
  isPaused?: boolean;
  teleprompterScrolling?: boolean;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type AudienceDeckResponse =
  | { status: "not_found" }
  | { status: "setup" }
  | { status: "ended"; thankYou?: boolean }
  | {
      status: "live";
      publicRunId: string;
      settings: {
        teleprompter_wpm: number;
        allow_audience_advance: boolean;
        current_slide_index: number;
      };
      slides: SlideAssignment[];
    };

export function isSlideLayout(value: string | null | undefined): value is SlideLayout {
  return (
    value === "hook" ||
    value === "point" ||
    value === "contrast" ||
    value === "scenario" ||
    value === "question" ||
    value === "reveal" ||
    value === "cue"
  );
}

export function normalizeLayout(value: string | null | undefined): SlideLayout {
  return isSlideLayout(value) ? value : "point";
}
