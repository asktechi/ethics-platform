import { PHASE46_SLIDES } from "@/lib/presentation/phase46-fixtures";
import type { SlideAssignment } from "@/lib/presentation/types";
import type { ThemePalette } from "@/lib/themes/types";

const THEME: ThemePalette = {
  name: "Fixture navy",
  bg: "#0B1B2B",
  accent: "#C9A227",
  text: "#F5F1E8",
  vignette: 0.32,
};

/** Intentionally 300+ words so the audience stage must scroll. */
export const PHASE74_LONG_BODY = [
  "Independence is not a slogan on the first slide of a training deck. It is the working rule that a recommendation can survive a room that wants a different answer, including the room that pays the bonus and the room that booked the suite.",
  "A research note is not a product brochure. The difference is the duty you owe the person who will live with the conclusion after you have left, and that duty does not shrink because the issuer was generous with access, dinner, or tickets during the visit.",
  "If a gift, a trip, or a quiet introduction would look like a price of admission to a reasonable client, it is already a conflict, whether or not anyone wrote a check and whether or not last year's rival analysts still published a critical note.",
  "Disclosure is the work of putting the conflict on the table before the advice, in language a client can actually use, not a footnote you hope nobody reads and not a verbal promise to check with compliance in the morning after the fact.",
  "Fair dealing is the same story in every room: the same risks, the same alternatives, the same reasons you would still hold the line if the client were your own family, and the same file that can reconstruct the advice when memory fails.",
  "Competence is not a certificate on the wall. It is the habit of knowing when you do not know enough, of refusing to fill the gap with confidence, and of changing the recommendation when the facts change rather than remaining silent because silence is easier.",
  "Loyalty to the client comes before loyalty to the firm when those loyalties conflict, and pressure from a producer is not a research conclusion. Records exist because memory is a poor witness, and a file that cannot defend the client cannot defend the professional either.",
  "Professionalism is the repeated choice to do the harder honest thing when the easier sentence would close the meeting. The standard is not a marketing line. It is the only thing that still belongs to the client after you leave the room, and it is why this passage is long enough that the audience stage must scroll instead of shrinking the type below a readable floor.",
  "A client who cannot understand the product cannot consent to it. Material conflicts belong on the table before the recommendation. The appearance of compromise can be as costly as the compromise itself, and the market will price silence as a recommendation of its own.",
].join(" ");

export const PHASE74_SHORT = PHASE46_SLIDES.A;
export const PHASE74_MEDIUM = PHASE46_SLIDES.B;

export const PHASE74_LONG: SlideAssignment = {
  slideId: "phase74-long",
  title: "Independence is a working rule",
  body: PHASE74_LONG_BODY,
  cue: "Pause after the gift sentence. Let the room sit with it.",
  speakerNote: PHASE74_LONG_BODY,
  layout: "point",
  theme: THEME,
  imageUrl: null,
  imageAttribution: null,
  generatedImageUrl: null,
};

export const PHASE74_HOOK: SlideAssignment = {
  ...PHASE46_SLIDES.D,
  generatedImageUrl: null,
};

export function phase74WordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const PHASE74_ASPECTS = {
  "16x9": { width: 1920, height: 1080, label: "16:9 projector" },
  "21x9": { width: 2560, height: 1080, label: "21:9 ultrawide" },
  "4x3": { width: 1024, height: 768, label: "4:3 projector" },
  "9x16": { width: 390, height: 844, label: "9:16 phone" },
  "3x2": { width: 1180, height: 820, label: "3:2 iPad" },
} as const;

export type Phase74Aspect = keyof typeof PHASE74_ASPECTS;
