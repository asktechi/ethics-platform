import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTO_REVEAL_DELAY_MS,
  countPacingProgress,
  majorityHasAdvanced,
  revealDelayMs,
  shouldAutoReveal,
} from "@/lib/quiz/pacing.ts";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const players = [
  { id: "p1" },
  { id: "p2" },
];
const questionId = "q1";
const afterFirst = countPacingProgress({
  players,
  responses: [{ participant_id: "p1", question_id: questionId }],
  questionId,
  now: 5_000,
});
pass("1 of 2 after first answer", afterFirst.label === "1 of 2 answered" && !afterFirst.allAnswered, afterFirst.label);

const afterBoth = countPacingProgress({
  players,
  responses: [
    { participant_id: "p1", question_id: questionId },
    { participant_id: "p2", question_id: questionId },
  ],
  questionId,
  now: 5_000,
});
pass("2 of 2 after second answer", afterBoth.label === "2 of 2 answered" && afterBoth.allAnswered, afterBoth.label);

const auto = shouldAutoReveal({
  modeId: "jeopardy",
  rehearsal: false,
  phase: "question",
  paused: false,
  timeUp: false,
  allAnswered: afterBoth.allAnswered,
});
pass("Jeopardy auto-reveal when all answered (not waiting 30s)", auto, "");
pass("reveal delay is 500ms, not 30s", revealDelayMs(true, false) === AUTO_REVEAL_DELAY_MS, String(revealDelayMs(true, false)));
pass(
  "timer expiry still reveals immediately",
  revealDelayMs(false, true) === 0 &&
    shouldAutoReveal({
      modeId: "jeopardy",
      rehearsal: false,
      phase: "question",
      paused: false,
      timeUp: true,
      allAnswered: false,
    }),
  "",
);

const solo = countPacingProgress({
  players: [{ id: "solo" }],
  responses: [{ participant_id: "solo", question_id: questionId }],
  questionId,
  now: 1_200,
});
pass("solo player all-answered after their answer", solo.allAnswered && solo.label === "1 of 1 answered", solo.label);

const dropped = countPacingProgress({
  players: [
    { id: "live", disconnectedSince: null },
    { id: "gone", disconnectedSince: 0 },
  ],
  responses: [{ participant_id: "live", question_id: questionId }],
  questionId,
  now: 3_000,
  disconnectGraceMs: 3000,
});
pass("disconnected player counts as answered after 3s", dropped.allAnswered, JSON.stringify(dropped));

const stillGrace = countPacingProgress({
  players: [
    { id: "live", disconnectedSince: null },
    { id: "gone", disconnectedSince: 0 },
  ],
  responses: [{ participant_id: "live", question_id: questionId }],
  questionId,
  now: 2_900,
  disconnectGraceMs: 3000,
});
pass("disconnect inside 3s does not count yet", !stillGrace.allAnswered, JSON.stringify(stillGrace));

pass(
  "Rapid Fire does not auto-reveal",
  !shouldAutoReveal({
    modeId: "rapid_fire",
    rehearsal: false,
    phase: "question",
    paused: false,
    timeUp: false,
    allAnswered: true,
  }),
  "",
);
pass(
  "Adaptive does not auto-reveal",
  !shouldAutoReveal({
    modeId: "adaptive",
    rehearsal: false,
    phase: "question",
    paused: false,
    timeUp: false,
    allAnswered: true,
  }),
  "",
);
pass(
  "rehearsal does not auto-reveal",
  !shouldAutoReveal({
    modeId: "jeopardy",
    rehearsal: true,
    phase: "question",
    paused: false,
    timeUp: false,
    allAnswered: true,
  }),
  "",
);

pass("majority 1 of 1", majorityHasAdvanced(1, 1), "");
pass("majority 1 of 2 is below 51%", !majorityHasAdvanced(1, 2), "");
pass("majority 2 of 3", majorityHasAdvanced(2, 3), "");
pass("majority 0 of 2", !majorityHasAdvanced(0, 2), "");

const host = readFileSync(join(process.cwd(), "app/quiz/host/[sessionId]/HostShell.tsx"), "utf8");
pass("host uses 500ms pacing helper", host.includes("revealDelayMs") && host.includes("countPacingProgress"), "");
pass("host shows live answered count", host.includes("All answered — revealing…") && host.includes("pacing.label"), "");
pass("host still has Skip and R", host.includes("Skip") && host.includes('event.key.toLowerCase() === "r"'), "");
pass("Rapid Fire auto-reveal still skipped", /if \(isRapid \|\| isAdaptive\) return;/.test(host), "");

const wizard = readFileSync(join(process.cwd(), "components/games/GameWizard.tsx"), "utf8");
pass(
  "wizard Step 4 pacing label",
  wizard.includes("Allow students to advance the question") && wizard.includes("Pacing"),
  "",
);
pass("wizard help text present", wizard.includes("When ON, students can tap") && wizard.includes("host controls advancement"), "");

const launch = readFileSync(join(process.cwd(), "lib/data/games.ts"), "utf8");
pass(
  "launch writes allow_audience_advance into quiz settings",
  launch.includes("allow_audience_advance: settings.allow_audience_advance === true"),
  "",
);

const player = readFileSync(join(process.cwd(), "app/quiz/play/[sessionId]/PlayerShell.tsx"), "utf8");
pass("player publishes PLAYER_ADVANCE", player.includes('type: "PLAYER_ADVANCE"'), "");
pass("player end nav has Back to Home", player.includes("PlayerEndNavBar") && player.includes("allowReplay"), "");

const jeopardy = readFileSync(join(process.cwd(), "app/quiz/play/[sessionId]/modes/JeopardyPlayer.tsx"), "utf8");
pass("Ready for next button exists", jeopardy.includes("Ready for next"), "");

const realtime = readFileSync(join(process.cwd(), "lib/quiz/realtime.ts"), "utf8");
pass("host listens for PLAYER_ADVANCE", realtime.includes("PLAYER_ADVANCE") && realtime.includes("onPlayerEvent"), "");

const summary = readFileSync(join(process.cwd(), "components/quiz/SessionSummary.tsx"), "utf8");
pass("host summary has end nav + close", summary.includes("HostEndNavBar") && summary.includes("HostCloseToGames"), "");

const sessionDetail = readFileSync(join(process.cwd(), "components/games/SessionDetail.tsx"), "utf8");
pass(
  "session detail has back/replay/clone",
  sessionDetail.includes("← Back to Games") &&
    sessionDetail.includes("Replay as host") &&
    sessionDetail.includes("Clone as new game"),
  "",
);

const boss = readFileSync(join(process.cwd(), "components/quiz/BossChrome.tsx"), "utf8");
pass("boss outcome uses host/player end nav", boss.includes("HostEndNavBar") && boss.includes("PlayerEndNavBar"), "");

const caseHost = readFileSync(join(process.cwd(), "app/quiz/host/[sessionId]/HostShell.tsx"), "utf8");
pass("case complete has back/dashboard links", caseHost.includes("CaseStudyHostEndLinks"), "");

const failed = results.filter((row) => !row.ok);
console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.map((row) => row.step), count: results.length }, null, 2));
if (failed.length) process.exit(1);
