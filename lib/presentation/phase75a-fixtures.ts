import type { SlideAssignment } from "@/lib/presentation/types";
import type { ThemePalette } from "@/lib/themes/types";

/** Navy / gold palette used to judge gradient quality with zero images. */
export const PHASE75A_THEME: ThemePalette = {
  name: "Independence dusk",
  bg: "#0B1B2B",
  accent: "#C9A227",
  text: "#F5F1E8",
  vignette: 0.36,
  gradientAngle: 148,
};

/**
 * Gradient quality fixture: no image_prompt, no concept pool, no AI image.
 * The designed theme gradient is the visual.
 */
export const PHASE75A_GRADIENT: SlideAssignment = {
  slideId: "phase75a-gradient",
  title: "Independence is a working rule",
  body: "A recommendation has to survive the room that wants a different answer — including the room that pays the bonus. The theme gradient is the stage. No photograph is required.",
  cue: null,
  speakerNote: null,
  layout: "point",
  theme: PHASE75A_THEME,
  imageUrl: null,
  imageAttribution: null,
  generatedImageUrl: null,
  imageStatus: "none",
  imagePreference: "none",
};

export const PHASE75A_NEXT: SlideAssignment = {
  slideId: "phase75a-next",
  title: "Disclosure before the product",
  body: "Put the conflict on the table in language a client can use. Then advance. The next slide is presentable without waiting on an image.",
  cue: null,
  speakerNote: null,
  layout: "hook",
  theme: {
    name: "Charter bronze",
    bg: "#121C2E",
    accent: "#D4B45A",
    text: "#F5F1E8",
    vignette: 0.34,
    gradientAngle: 210,
  },
  imageUrl: null,
  imageAttribution: null,
  generatedImageUrl: null,
  imageStatus: "none",
  imagePreference: "none",
};
