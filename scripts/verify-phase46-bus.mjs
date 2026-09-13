import { dispatch, getPresentationState, resetPresentationBus } from "@/lib/presentation/bus.ts";
import { PHASE46_SLIDES } from "@/lib/presentation/phase46-fixtures.ts";
import { paginateFixture } from "@/lib/presentation/phase46-fixtures.ts";
import { CANONICAL_VIEWPORT } from "@/lib/presentation/beats.ts";

resetPresentationBus();
const longBody = Array.from({ length: 24 }, (_, i) => `Sentence number ${i + 1} about professional conduct and client loyalty.`).join(" ");
const long = { ...PHASE46_SLIDES.C, slideId: "bus-c", body: longBody, title: "Overflow" };
const nextSlide = { ...PHASE46_SLIDES.A, slideId: "bus-a" };
dispatch({
  type: "HYDRATE",
  state: {
    mode: "host",
    assignments: [long, nextSlide],
    slideCount: 2,
    currentSlideIndex: 0,
    currentBeatIndex: 0,
    teleprompterLineIndex: -1,
  },
});

const beats = paginateFixture(long, CANONICAL_VIEWPORT).beats;
dispatch({ type: "TELEPROMPTER_LINE", slideIndex: 0, lineIndex: beats[0]?.endLineIndex ?? 0 });
const afterLine = getPresentationState();

dispatch({ type: "BEAT", direction: 1 });
const afterBeat = getPresentationState();

dispatch({ type: "NEXT" });
const afterNext = getPresentationState();

dispatch({ type: "PREV" });
const afterPrev = getPresentationState();

const report = {
  beatCount: beats.length,
  afterLine: { beat: afterLine.currentBeatIndex, slide: afterLine.currentSlideIndex },
  afterBeat: { beat: afterBeat.currentBeatIndex, slide: afterBeat.currentSlideIndex, line: afterBeat.teleprompterLineIndex },
  afterNext: { beat: afterNext.currentBeatIndex, slide: afterNext.currentSlideIndex },
  afterPrev: { beat: afterPrev.currentBeatIndex, slide: afterPrev.currentSlideIndex },
};

const failures = [];
if (afterNext.currentSlideIndex !== 1) failures.push("NEXT should skip remaining beats and leave the slide");
if (afterNext.currentBeatIndex !== 0) failures.push("NEXT should reset beat to 0");
if (afterPrev.currentSlideIndex !== 0) failures.push("PREV from slide 1 beat 0 should return to previous slide");
if (beats.length > 1 && afterBeat.currentBeatIndex < 1 && afterBeat.currentSlideIndex === 0) {
  failures.push("B / BEAT +1 should advance beat when more than one exists");
}

console.log(JSON.stringify({ ok: failures.length === 0, report, failures }, null, 2));
if (failures.length) process.exit(1);
