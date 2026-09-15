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
  /**
   * Phase 7.5 hook. When a generated image exists, it overrides the curated
   * `imageUrl` on the audience stage. Do not populate this in 7.4.
   */
  generatedImageUrl?: string | null;
  imageStatus?: "none" | "queued" | "generating" | "ready" | "failed";
  imagePreference?: "auto" | "pool" | "ai" | "none";
};

export type BusEventType =
  | "NEXT"
  | "PREV"
  | "GOTO"
  | "PAUSE"
  | "RESUME"
  | "END"
  | "TELEPROMPTER_LINE"
  | "BEAT"
  | "RESYNC";

export type BusEvent =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; index: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END" }
  | { type: "TELEPROMPTER_LINE"; slideIndex: number; lineIndex: number }
  | { type: "SET_TELEPROMPTER_LINE"; slideIndex: number; lineIndex: number }
  | { type: "SET_REVEAL_FLUSH"; flushed: boolean }
  | { type: "SET_MODE"; mode: PresentationMode }
  | { type: "SET_ASSIGNMENTS"; assignments: SlideAssignment[] }
  | { type: "SET_PEAK_AUDIENCE"; count: number }
  | {
      type: "BEAT";
      slideIndex?: number;
      beatIndex?: number;
      direction?: 1 | -1;
    }
  | {
      type: "RESYNC";
      slideIndex: number;
      beatIndex: number;
      lineIndex: number;
      isPaused: boolean;
      ended?: boolean;
      teleprompterScrolling?: boolean;
      revealAll?: boolean;
    }
  | {
      type: "HYDRATE";
      state: Partial<PresentationBusState>;
    };

export type EventOrigin = "local" | "remote";

export type PresentationBusState = {
  currentSlideIndex: number;
  currentBeatIndex: number;
  isPaused: boolean;
  teleprompterScrolling: boolean;
  teleprompterLineIndex: number;
  revealFlushed: boolean;
  mode: PresentationMode;
  runId: string | null;
  assignments: SlideAssignment[];
  slideCount: number;
  ended: boolean;
  slidesAdvanced: number;
  peakAudience: number;
};

export type RealtimeEnvelope = {
  type: BusEventType | "SNAPSHOT" | "RESYNC";
  slideIndex: number;
  ts: number;
  lineIndex?: number;
  beatIndex?: number;
  ended?: boolean;
  isPaused?: boolean;
  teleprompterScrolling?: boolean;
  revealAll?: boolean;
};

/** Host ↔ audience lock fields used by RESYNC and ?sync=debug. */
export type SyncFingerprint = {
  slideIndex: number;
  beatIndex: number;
  lineIndex: number;
  isPaused: boolean;
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
        audience_reveal_mode: "progressive" | "instant";
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
