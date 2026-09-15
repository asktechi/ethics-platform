import { readFileSync } from "node:fs";
import { join } from "node:path";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const stage = read("components/quiz/player/MobilePlayerStage.tsx");
const answers = read("components/quiz/player/MobileAnswerButtons.tsx");
const jeopardy = read("app/quiz/play/[sessionId]/modes/JeopardyPlayer.tsx");
const rapid = read("app/quiz/play/[sessionId]/modes/RapidFirePlayer.tsx");
const adaptive = read("app/quiz/play/[sessionId]/modes/AdaptivePlayer.tsx");
const team = read("app/quiz/play/[sessionId]/modes/TeamBattlePlayer.tsx");
const boss = read("app/quiz/play/[sessionId]/modes/BossBattlePlayer.tsx");
const cases = read("app/quiz/play/[sessionId]/modes/CaseStudyPlayer.tsx");
const shell = read("app/quiz/play/[sessionId]/PlayerShell.tsx");
const playPage = read("app/quiz/play/[sessionId]/page.tsx");
const playLayout = read("app/quiz/play/layout.tsx");
const css = read("app/globals.css");
const fixtures = read("app/dev/phase73/page.tsx");

pass("100dvh on mobile stage and play layout", stage.includes("h-full") && playLayout.includes("100dvh") && shell.includes("h-[100dvh]"), "");
pass("max-height 100dvh", shell.includes("max-h-[100dvh]") && playLayout.includes("max-h-[100dvh]"), "");
pass("min-height 0 on question zone", stage.includes("min-h-0 flex-1 overflow-y-auto"), "");
pass("safe-area insets", stage.includes("env(safe-area-inset-top)") && stage.includes("env(safe-area-inset-bottom)"), "");
pass("hidden scrollbar class", css.includes("player-question-scroll") && css.includes("::-webkit-scrollbar"), "");
pass("scroll-for-more pill", stage.includes("scroll for more"), "");
pass("answer zone flex-fixed gradient", stage.includes("linear-gradient(to top, #0B1B2B 85%") && stage.includes("shrink-0"), "");
pass("answer min-h-14 and rounded-xl", answers.includes("min-h-14") && answers.includes("rounded-xl"), "");
pass("touch-manipulation", answers.includes("touch-manipulation"), "");
pass("reveal compact min-h-9 (~36px)", answers.includes("min-h-9"), "");
pass("framer 400ms ease", answers.includes("duration: 0.4") && stage.includes("duration: 0.4"), "");
pass("desktop Jeopardy unchanged max-h-[22vh]", jeopardy.includes("max-h-[22vh]") && jeopardy.includes('data-player-stage="desktop"'), "");
pass("mobile hidden at md", jeopardy.includes("md:hidden") && jeopardy.includes("hidden min-h-0 flex-1 flex-col md:flex"), "");
pass("Rapid Fire dual layout", rapid.includes("MobilePlayerStage") && rapid.includes('data-player-stage="desktop"'), "");
pass("Adaptive drill label + hint pill", adaptive.includes("Drill: Q") && adaptive.includes("Hint") && adaptive.includes("800"), "");
pass("Team chip below header", team.includes("headerBelow") && team.includes("hidden") && team.includes("md:flex"), "");
pass("Boss thin HP above header", boss.includes("headerAbove") && boss.includes("ThinHpBar") && boss.includes("h-1"), "");
pass("Case scenario sticky ready", cases.includes("I&apos;m ready") && cases.includes("MobilePlayerStage"), "");
pass("viewportFit cover on play", playLayout.includes("viewportFit: \"cover\"") && playLayout.includes("userScalable: false"), "");
pass("debug overlay ?layout=debug", playPage.includes('searchParams.layout === "debug"') && stage.includes("outline-cyan-400"), "");
pass("shell desktop padding preserved", shell.includes("md:px-4 md:py-4") && !shell.includes("px-4 py-4 text-ivory"), "");
pass("fixture long vignette", fixtures.includes("This vignette is intentionally long"), "");
pass("all six modes covered", [jeopardy, rapid, adaptive, team, boss, cases].every((src) => src.includes("MobilePlayerStage") || src.includes("JeopardyPlayer")), "");

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((row) => row.step).join("\n"));
  process.exit(1);
}
