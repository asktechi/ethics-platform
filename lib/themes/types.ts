export type ThemePalette = {
  bg: string;
  accent: string;
  text: string;
  name?: string;
  gradientAngle?: number;
  vignette?: number;
};

export type RunSettings = {
  seconds_per_slide: number;
  teleprompter_wpm: number;
  use_image_pools: boolean;
  theme_mode: "shuffle" | "locked";
  locked_theme_id?: string | null;
  theme_overrides?: Record<string, string>;
  allow_audience_advance?: boolean;
  audience_reveal_mode?: "progressive" | "instant";
  auto_generate_images?: boolean;
  current_slide_index?: number;
  peak_audience?: number;
  slides_advanced?: number;
  slide_seconds?: number[];
  questions_asked?: number;
};

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  seconds_per_slide: 0,
  teleprompter_wpm: 130,
  use_image_pools: true,
  theme_mode: "shuffle",
  locked_theme_id: null,
  theme_overrides: {},
  allow_audience_advance: false,
  audience_reveal_mode: "progressive",
  auto_generate_images: false,
  current_slide_index: 0,
  peak_audience: 0,
  slides_advanced: 0,
  slide_seconds: [],
  questions_asked: 0,
};

export type ThemeReelItem = {
  slide_id: string;
  title: string;
  body: string;
  status: "draft" | "approved";
  theme_id: string;
  theme_name: string;
  theme_json: ThemePalette;
  image_url: string | null;
  image_attribution: string | null;
  override: boolean;
};

export function parseRunSettings(value: unknown): RunSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const overrides =
    raw.theme_overrides && typeof raw.theme_overrides === "object"
      ? (raw.theme_overrides as Record<string, string>)
      : {};
  return {
    seconds_per_slide: Number(raw.seconds_per_slide ?? 0) || 0,
    teleprompter_wpm: Number(raw.teleprompter_wpm ?? 130) || 130,
    use_image_pools: raw.use_image_pools !== false,
    theme_mode: raw.theme_mode === "locked" ? "locked" : "shuffle",
    locked_theme_id: typeof raw.locked_theme_id === "string" ? raw.locked_theme_id : null,
    theme_overrides: overrides,
    allow_audience_advance: raw.allow_audience_advance === true,
    audience_reveal_mode: raw.audience_reveal_mode === "instant" ? "instant" : "progressive",
    auto_generate_images: raw.auto_generate_images === true,
    current_slide_index: Math.max(0, Number(raw.current_slide_index ?? 0) || 0),
    peak_audience: Math.max(0, Number(raw.peak_audience ?? 0) || 0),
    slides_advanced: Math.max(0, Number(raw.slides_advanced ?? 0) || 0),
    slide_seconds: Array.isArray(raw.slide_seconds)
      ? (raw.slide_seconds as unknown[]).map((value) => Math.max(0, Number(value) || 0))
      : [],
    questions_asked: Math.max(0, Number(raw.questions_asked ?? 0) || 0),
  };
}
