import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dispatch, getPresentationState, resetPresentationBus } from "@/lib/presentation/bus.ts";
import {
  CANONICAL_VIEWPORT,
  paginateAssignment,
  setPaginationViewport,
} from "@/lib/presentation/beats.ts";
import { PHASE46_SLIDES } from "@/lib/presentation/phase46-fixtures.ts";
import { PHASE74_LONG, PHASE74_SHORT, phase74WordCount } from "@/lib/presentation/phase74-fixtures.ts";
import { evaluateSyncDot, fingerprintsEqual, fingerprintOf, recordAudienceAck, recordRemoteFingerprint } from "@/lib/presentation/sync.ts";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const mirror = read("components/presentation/AudienceMirror.tsx");
const audience = read("components/presentation/AudienceView.tsx");
const tele = read("components/presentation/Teleprompter.tsx");
const css = read("app/globals.css");
const realtime = read("lib/presentation/realtime.ts");
const types = read("lib/presentation/types.ts");
const beats = read("lib/presentation/beats.ts");
const background = read("components/presentation/ThemeBackground.tsx");
const host = read("components/presentation/HostView.tsx");
const fixtures = read("lib/presentation/phase74-fixtures.ts");
const stage = read("components/quiz/player/MobilePlayerStage.tsx");
const jeopardy = read("app/quiz/play/[sessionId]/modes/JeopardyPlayer.tsx");

pass("audience stage 100dvh", css.includes(".audience-stage") && css.includes("height: 100dvh") && audience.includes("h-[100dvh]"), "");
pass("slide-content min-height 0 overflow-y auto", css.includes("min-height: 0") && css.includes("overflow-y: auto") && css.includes(".slide-content"), "");
pass("headline clamp 32/6vw/96", css.includes("clamp(32px, 6vw, 96px)"), "");
pass("body clamp 16/2.4vw/32", css.includes("clamp(16px, 2.4vw, 32px)"), "");
pass("teleprompter clamp 16/1.6vw/22", css.includes("clamp(16px, 1.6vw, 22px)") && tele.includes("teleprompter-copy"), "");
pass("gold 4px brand bar", mirror.includes("data-brand-bar") && mirror.includes("h-[4px]"), "");
pass("scroll hint ↓", mirror.includes("data-scroll-hint") && mirror.includes("↓"), "");
pass("reveal 400ms translateY 8", mirror.includes("y: 8") && mirror.includes("duration: 0.4"), "");
pass("older lines 0.75", mirror.includes("older ? 0.75"), "");
pass("beat fade 200/300", mirror.includes("duration: 0.2") && mirror.includes("duration: 0.3"), "");
pass("host gold bar only when chrome", mirror.includes("hostCurrentLine={showChrome ? hostLineInBeat : -1}"), "");
pass("canonical viewport locked", beats.includes("Beat pagination is locked") && beats.includes("intentionally unused"), "");
pass("RESYNC type", types.includes('"RESYNC"') && realtime.includes('RESYNC_EVENT = "resync"') && realtime.includes("broadcastResync"), "");
pass("rehearsal does not broadcast RESYNC", realtime.includes("rehearsal — not broadcasting RESYNC"), "");
pass("generatedImageUrl hook", types.includes("generatedImageUrl") && mirror.includes("slide.generatedImageUrl") && background.includes("Phase 7.5"), "");
pass("sync debug ?sync=debug", read("components/presentation/SyncDebugDot.tsx").includes('get("sync") === "debug"') && audience.includes("SyncDebugDot"), "");
pass("host still has teleprompter + next panel", host.includes("<Teleprompter") && host.includes("<NextUpPanel"), "");
pass("teleprompter gold underline current", tele.includes("decoration-[#C9A227]") && tele.includes('data-prompter-state={active ? "current"'), "");
pass("games player unchanged 100dvh stage", stage.includes("min-h-0 flex-1 overflow-y-auto") && jeopardy.includes('data-player-stage="desktop"'), "");
pass("long fixture 300+ words", phase74WordCount(PHASE74_LONG.body) >= 300, `${phase74WordCount(PHASE74_LONG.body)} words`);
pass("fixture page exists", fixtures.includes("PHASE74_LONG_BODY") && read("app/dev/phase74/page.tsx").includes("view === \"host\""), "");

setPaginationViewport({ width: 390, height: 844 });
const phone = paginateAssignment(PHASE74_LONG);
setPaginationViewport({ width: 1920, height: 1080 });
const desktop = paginateAssignment(PHASE74_LONG);
const explicit = paginateAssignment(PHASE74_LONG, { width: 800, height: 600 });
pass(
  "host and phone share beat count",
  phone.beats.length === desktop.beats.length && desktop.beats.length === explicit.beats.length,
  `beats=${desktop.beats.length} canonical=${CANONICAL_VIEWPORT.width}x${CANONICAL_VIEWPORT.height}`,
);

resetPresentationBus();
dispatch({
  type: "HYDRATE",
  state: {
    mode: "audience",
    assignments: [PHASE74_SHORT, PHASE46_SLIDES.B],
    slideCount: 2,
    currentSlideIndex: 0,
    currentBeatIndex: 0,
    teleprompterLineIndex: -1,
    isPaused: false,
  },
});
dispatch({
  type: "RESYNC",
  slideIndex: 1,
  beatIndex: 2,
  lineIndex: 4,
  isPaused: true,
  teleprompterScrolling: false,
});
const synced = getPresentationState();
pass(
  "RESYNC hydrates slide/beat/line/pause",
  synced.currentSlideIndex === 1 &&
    synced.currentBeatIndex === 2 &&
    synced.teleprompterLineIndex === 4 &&
    synced.isPaused === true,
  JSON.stringify({
    slide: synced.currentSlideIndex,
    beat: synced.currentBeatIndex,
    line: synced.teleprompterLineIndex,
    paused: synced.isPaused,
  }),
);

const local = fingerprintOf(synced);
recordRemoteFingerprint(local);
recordAudienceAck(local);
const green = evaluateSyncDot({ role: "audience", local, now: Date.now() });
pass("sync debug green when fingerprints match", green.status === "green" && fingerprintsEqual(local, local), green.status);

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((row) => row.step).join("\n"));
  process.exit(1);
}
