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

export const PHASE46_SLIDE_LONG_BODY = [
  "A research note is not a product brochure, and the difference is the duty you owe the person who will live with the recommendation.",
  "Independence means the conclusion can survive a room that wants a different answer, including the room that pays your bonus.",
  "If a gift, a trip, or a quiet introduction would look like a price of admission, it is already a conflict, whether or not anyone wrote a check.",
  "Disclosure is the work of putting the conflict on the table before the advice, in language a client can actually use.",
  "Fair dealing is the same story in every room: the same risks, the same alternatives, the same reasons you would still hold the line if the client were your own family.",
  "Competence is not a certificate on the wall. It is the habit of knowing when you do not know enough, and of refusing to fill the gap with confidence.",
  "Records exist because memory is a poor witness, and because a file that cannot reconstruct the advice cannot defend the client.",
  "When the facts change, the recommendation must change with them. Silence is also a recommendation, and the market will price it.",
  "Professionalism is the repeated choice to do the harder honest thing when the easier sentence would close the meeting.",
  "The standard is not a slogan. It is a working rule, and it is the only thing that still belongs to the client after you leave the room.",
].join(" ");

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
  long: assignment("phase46-long", "", PHASE46_SLIDE_LONG_BODY, "point"),
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
