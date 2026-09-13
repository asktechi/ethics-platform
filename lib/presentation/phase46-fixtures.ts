import { CANONICAL_VIEWPORT, paginateSlide } from "@/lib/presentation/beats";
import { splitRevealLines } from "@/lib/presentation/speaker-notes";
import type { SlideAssignment } from "@/lib/presentation/types";
import type { ThemePalette } from "@/lib/themes/types";

const THEME: ThemePalette = {
  name: "Fixture navy",
  bg: "#0B1B2B",
  accent: "#C9A227",
  text: "#F5F1E8",
  vignette: 0.32,
};

export const PHASE46_SLIDE_A_BODY = "The dog is beautiful and smart.";

export const PHASE46_SLIDE_B_BODY =
  "Independence is the first duty of every recommendation. Clients must hear the conflict before they hear the product. The standard is not a slogan; it is a working rule. Silence is a choice, and the market will price it.";

export const PHASE46_SLIDE_C_BODY = [
  "Loyalty to the client comes before loyalty to the firm.",
  "A gift is never free when it changes the advice that follows.",
  "Disclosure is not a footnote you hope nobody reads.",
  "Material conflicts belong on the table before the recommendation.",
  "The appearance of compromise can be as costly as the compromise itself.",
  "Records exist so memory is not the only witness.",
  "Fair dealing means the same story in every room.",
  "Competence is a duty, not a credential on the wall.",
  "When the facts change, the recommendation must change with them.",
  "Pressure from a producer is not a research conclusion.",
  "A client who cannot understand the product cannot consent to it.",
  "Professionalism is the habit of doing the harder honest thing.",
].join(" ");

export const PHASE46_SLIDE_D_TITLE = "PROFESSIONALISM";

function assignment(
  id: string,
  title: string,
  body: string,
  layout: SlideAssignment["layout"],
): SlideAssignment {
  return {
    slideId: id,
    title,
    body,
    cue: null,
    speakerNote: null,
    layout,
    theme: THEME,
    imageUrl: null,
    imageAttribution: null,
  };
}

export const PHASE46_SLIDES = {
  A: assignment("phase46-a", "", PHASE46_SLIDE_A_BODY, "hook"),
  B: assignment("phase46-b", "Four duties in view", PHASE46_SLIDE_B_BODY, "point"),
  C: assignment("phase46-c", "A longer argument", PHASE46_SLIDE_C_BODY, "point"),
  D: assignment("phase46-d", PHASE46_SLIDE_D_TITLE, "", "hook"),
  blank: assignment("phase46-blank", "Integrity first", "", "hook"),
};

export function paginateFixture(
  slide: SlideAssignment,
  viewport: { width: number; height: number } = CANONICAL_VIEWPORT,
) {
  return paginateSlide({
    slide: { id: slide.slideId, title: slide.title, body: slide.body },
    lines: splitRevealLines(slide.body),
    viewport,
    layout: slide.layout,
  });
}
