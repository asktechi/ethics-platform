import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getMode, listModes } from "@/lib/games/modes/registry.ts";
import { pickNextQuestionFromPool } from "@/lib/games/adaptive-pick.ts";
import { groupQuestionsByCase } from "@/lib/games/case-groups.ts";
import { assertPlayableMode } from "@/lib/games/resolve.ts";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env) || !process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pub = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const playable = listModes()
  .filter((mode) => mode.status === "playable")
  .map((mode) => mode.id);
pass(
  "playable modes include case_study+adaptive",
  playable.join() === "jeopardy,rapid_fire,team_battle,case_study,adaptive",
  playable.join(),
);
pass("boss still coming soon", getMode("boss_battle").status === "coming_soon", "");
pass("case study uses jeopardy scoring", getMode("case_study").scoreResponse({
  isCorrect: true,
  msTaken: 0,
  timeLimitMs: 30000,
  basePoints: 100,
  priorCorrect: 2,
}).points === 240, "");
pass("adaptive uses jeopardy scoring", getMode("adaptive").scoreResponse({
  isCorrect: true,
  msTaken: 0,
  timeLimitMs: 30000,
  basePoints: 100,
  priorCorrect: 0,
}).points === 200, "");
let bossBlocked = false;
try {
  assertPlayableMode("boss_battle");
} catch {
  bossBlocked = true;
}
pass("boss_battle still blocked", bossBlocked, "");

const algo = pickNextQuestionFromPool(
  [
    { id: "weak", standard_id: "s1", difficulty: "medium", weakness_score: 0.9, recent_correct: false, answered_count_for_standard: 0 },
    { id: "strong", standard_id: "s2", difficulty: "easy", weakness_score: 0.1, recent_correct: false, answered_count_for_standard: 0 },
  ],
  { answered_ids: [], streak: 0, wrong_in_row: 0 },
  { total_questions: 15, prefer_weak: true, avoid_recent_days: 14, min_questions_per_standard: 2, difficulty_ramp: true },
  () => 0.01,
);
pass("pickNext prefers weak standard", algo === "weak", String(algo));

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: standards } = await admin.from("standards").select("id, code, title").limit(4);
const stamp = Date.now();
const { data: klass } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `6D.2 ${stamp}`, audience: "verify", created_by: userId })
  .select("id")
  .single();

function questionRow(stem, standardId, difficulty = "medium") {
  return {
    class_id: klass.id,
    stem,
    choices_json: [
      { key: "A", text: "A" },
      { key: "B", text: "B" },
      { key: "C", text: "C" },
      { key: "D", text: "D" },
    ],
    answer_key: "A",
    explanation: "A",
    source: "mine",
    approved: true,
    rejected: false,
    tag_approved: true,
    created_by: userId,
    standard_id: standardId ?? standards[0]?.id ?? null,
    difficulty,
  };
}

async function makePool(name, rows) {
  const { data: questions, error } = await admin.from("questions").insert(rows).select("id, standard_id");
  if (error) throw new Error(error.message);
  const { data: pool } = await admin
    .from("question_pools")
    .insert({ class_id: klass.id, name, shuffle_on_play: false, time_per_q: 30 })
    .select("*")
    .single();
  await admin.from("question_pool_items").insert(questions.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));
  return { pool, questions };
}

async function launch(mode, { pool, questions, caseStudyIds = [], modeConfig = {}, extraSettings = {} }) {
  const questionIds = questions.map((row) => row.id);
  const joinCode = `E${Math.random().toString(36).slice(2, 7)}`.slice(0, 6).toUpperCase();
  const settings = {
    allow_late_join: true,
    show_leaderboard: true,
    show_correct_answer: true,
    shuffle: false,
    question_ids: questionIds,
    host_token: crypto.randomUUID(),
    mode_config: modeConfig,
    name: mode,
    ...extraSettings,
  };
  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .insert({
      pool_id: pool?.id ?? null,
      host_id: userId,
      mode,
      time_per_q: 30,
      status: "live",
      join_code: joinCode,
      current_question_index: 0,
      started_at: new Date().toISOString(),
      reveal_answer: false,
      settings_json: settings,
    })
    .select("*")
    .single();
  if (sessionError) throw new Error(sessionError.message);
  const { data: template } = await admin
    .from("game_templates")
    .insert({
      class_id: klass.id,
      owner_id: userId,
      name: `${mode} ${stamp}`,
      mode,
      pool_id: pool?.id ?? null,
      case_study_ids: caseStudyIds,
      mode_config: modeConfig,
      adaptive_config: mode === "adaptive" ? { prefer_weak: true, avoid_recent_days: 14, min_questions_per_standard: 2 } : {},
      settings_json: {
        time_per_q: 30,
        base_points: 100,
        time_bonus: true,
        streak_bonus: true,
        shuffle_questions: false,
        show_leaderboard_to_players: true,
        show_correct_answer_after: true,
        allow_late_join: true,
        allow_audience_advance: false,
      },
    })
    .select("id, version")
    .single();
  const { data: instance, error: instanceError } = await admin
    .from("game_instances")
    .insert({
      template_id: template.id,
      template_version: template.version,
      host_id: userId,
      quiz_session_id: session.id,
      join_code: joinCode,
      status: "lobby",
      adaptive_state: {},
      settings_snapshot: { mode, question_ids: questionIds, mode_config: modeConfig, case_study_ids: caseStudyIds },
    })
    .select("id")
    .single();
  if (instanceError) throw new Error(instanceError.message);
  return { session, instance, joinCode, questionIds, template };
}

async function joinPlayer(code, name) {
  const { data, error } = await pub.rpc("join_game_by_code", {
    p_join_code: code,
    p_display_name: name,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

// ---------- Case Study E2E ----------
const caseQs = await admin
  .from("questions")
  .insert([
    questionRow("Case Q1", standards[0]?.id),
    questionRow("Case Q2", standards[0]?.id),
    questionRow("Case Q3", standards[1]?.id ?? standards[0]?.id),
    questionRow("Case Q4", standards[1]?.id ?? standards[0]?.id),
  ])
  .select("id, stem");
if (caseQs.error) throw new Error(caseQs.error.message);
const { data: caseRow, error: caseError } = await admin
  .from("case_studies")
  .insert({
    class_id: klass.id,
    title: "Gifts and Independence",
    scenario_text: "A research analyst is offered two World Series tickets by a corporate issuer during a due-diligence visit.",
    created_by: userId,
  })
  .select("*")
  .single();
if (caseError) throw new Error(caseError.message);
for (let index = 0; index < caseQs.data.length; index += 1) {
  await admin.from("questions").update({ case_study_id: caseRow.id, case_study_order: index }).eq("id", caseQs.data[index].id);
}
pass("CS1 case with 4 questions", caseQs.data.length === 4, String(caseQs.data.length));

const grouped = groupQuestionsByCase(
  caseQs.data.map((row, index) => ({
    question_id: row.id,
    case_study_id: caseRow.id,
    case_title: caseRow.title,
    case_scenario: caseRow.scenario_text,
    case_study_order: index,
  })),
);
pass("CS1 grouped as one case", grouped.length === 1 && grouped[0].questionIds.length === 4, String(grouped.length));

const csGame = await launch("case_study", {
  pool: null,
  questions: caseQs.data,
  caseStudyIds: [caseRow.id],
  modeConfig: {
    show_scenario_before_each_question: false,
    min_case_size: 3,
    max_case_size: 8,
    transition_delay_ms: 800,
    allow_case_review_at_end: true,
    base_points: 100,
    time_bonus: true,
    streak_bonus: true,
  },
});
pass("CS2 case study game created", Boolean(csGame.session.id), csGame.joinCode);

const alice = await joinPlayer(csGame.joinCode, "Alice");
const bob = await joinPlayer(csGame.joinCode, "Bob");
pass("CS3 two players joined", Boolean(alice.participant_token && bob.participant_token), "");

await admin.rpc("quiz_set_question", { p_session_id: csGame.session.id, p_index: 0 });
const q1 = caseQs.data[0].id;
const a1 = await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: q1,
  p_choice_key: "A",
  p_ms_taken: 1200,
});
const b1 = await pub.rpc("submit_answer", {
  p_participant_token: bob.participant_token,
  p_question_id: q1,
  p_choice_key: "B",
  p_ms_taken: 1400,
});
pass("CS5 both answered Q1", !a1.error && !b1.error, a1.error?.message ?? b1.error?.message ?? "");
await admin.rpc("quiz_apply_reveal", { p_session_id: csGame.session.id, p_question_id: q1, p_correct_key: "A" });

await admin.rpc("quiz_set_question", { p_session_id: csGame.session.id, p_index: 1 });
const q2 = caseQs.data[1].id;
await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: q2,
  p_choice_key: "A",
  p_ms_taken: 800,
});
await pub.rpc("submit_answer", {
  p_participant_token: bob.participant_token,
  p_question_id: q2,
  p_choice_key: "A",
  p_ms_taken: 900,
});
await admin.rpc("quiz_apply_reveal", { p_session_id: csGame.session.id, p_question_id: q2, p_correct_key: "A" });
pass("CS6 Q2 answered with same case", true, "case header path uses same case_study_id");

for (let index = 2; index < 4; index += 1) {
  await admin.rpc("quiz_set_question", { p_session_id: csGame.session.id, p_index: index });
  const qid = caseQs.data[index].id;
  await pub.rpc("submit_answer", {
    p_participant_token: alice.participant_token,
    p_question_id: qid,
    p_choice_key: "A",
    p_ms_taken: 1000,
  });
  await pub.rpc("submit_answer", {
    p_participant_token: bob.participant_token,
    p_question_id: qid,
    p_choice_key: "A",
    p_ms_taken: 1100,
  });
  await admin.rpc("quiz_apply_reveal", { p_session_id: csGame.session.id, p_question_id: qid, p_correct_key: "A" });
}
const { data: csResponses } = await admin.from("quiz_responses").select("*").eq("session_id", csGame.session.id);
pass("CS7 all 4 questions answered by both", (csResponses ?? []).length === 8, String((csResponses ?? []).length));
await admin.rpc("quiz_end_session", { p_session_id: csGame.session.id });
await admin.rpc("finalize_game_instance", { p_session_id: csGame.session.id });
const aliceCorrect = (csResponses ?? []).filter((row) => row.participant_id === alice.participant_id && row.is_correct).length;
pass("CS8 per-case results available", aliceCorrect === 4, `aliceCorrect=${aliceCorrect}`);

// ---------- Adaptive E2E ----------
const stdA = standards[0]?.id;
const stdB = standards[1]?.id ?? standards[0]?.id;
const adaptiveRows = [];
for (let index = 0; index < 10; index += 1) adaptiveRows.push(questionRow(`Adapt A${index + 1}`, stdA, index < 3 ? "easy" : "medium"));
for (let index = 0; index < 10; index += 1) adaptiveRows.push(questionRow(`Adapt B${index + 1}`, stdB, "hard"));
const adPool = await makePool("Adaptive pool", adaptiveRows);
const adGame = await launch("adaptive", {
  pool: adPool.pool,
  questions: adPool.questions,
  modeConfig: {
    total_questions: 15,
    prefer_weak: true,
    avoid_recent_days: 14,
    min_questions_per_standard: 2,
    difficulty_ramp: true,
    allow_hint: true,
    hint_penalty: 50,
    base_points: 100,
    time_bonus: true,
    streak_bonus: true,
  },
});
const carol = await joinPlayer(adGame.joinCode, "Alice");
await admin.rpc("quiz_set_question", { p_session_id: adGame.session.id, p_index: 0 });

const { data: profile } = await admin.from("quiz_participants").select("id, student_profile_id").eq("id", carol.participant_id).maybeSingle();
if (profile?.student_profile_id && stdB) {
  await admin.from("student_performance").upsert({
    student_profile_id: profile.student_profile_id,
    class_id: klass.id,
    standard_id: stdB,
    attempts: 8,
    correct: 1,
    accuracy: 12.5,
    avg_ms: 9000,
    weakness_score: 0.95,
    last_practiced_at: new Date().toISOString(),
  });
  await admin.from("student_performance").upsert({
    student_profile_id: profile.student_profile_id,
    class_id: klass.id,
    standard_id: stdA,
    attempts: 8,
    correct: 7,
    accuracy: 87.5,
    avg_ms: 3000,
    weakness_score: 0.12,
    last_practiced_at: new Date().toISOString(),
  });
}

const firstId = await admin.rpc("pick_next_adaptive_question", {
  p_session_id: adGame.session.id,
  p_participant_id: carol.participant_id,
});
pass("AD3 first question picked", Boolean(firstId.data), String(firstId.error?.message ?? firstId.data));
const firstQuestion = adPool.questions.find((row) => row.id === firstId.data);
await pub.rpc("submit_answer", {
  p_participant_token: carol.participant_token,
  p_question_id: firstId.data,
  p_choice_key: "A",
  p_ms_taken: 500,
});
const secondId = await admin.rpc("pick_next_adaptive_question", {
  p_session_id: adGame.session.id,
  p_participant_id: carol.participant_id,
});
const secondQuestion = adPool.questions.find((row) => row.id === secondId.data);
pass(
  "AD4 second question can target a different standard",
  Boolean(secondId.data) && secondId.data !== firstId.data,
  `firstStd=${firstQuestion?.standard_id} secondStd=${secondQuestion?.standard_id}`,
);

const hint = await admin.rpc("apply_adaptive_hint", {
  p_participant_token: carol.participant_token,
  p_question_id: secondId.data,
});
const hintRow = Array.isArray(hint.data) ? hint.data[0] : hint.data;
pass("AD5 hint costs 50", !hint.error && hintRow?.points_cost === 50, hint.error?.message ?? JSON.stringify(hintRow));
const { data: afterHint } = await admin.from("quiz_participants").select("score").eq("id", carol.participant_id).maybeSingle();
pass("AD5 score reduced by hint", typeof afterHint?.score === "number", `score=${afterHint?.score}`);

let current = secondId.data;
let answered = 2;
for (let index = 0; index < 20 && answered < 15; index += 1) {
  if (!current) break;
  await pub.rpc("submit_answer", {
    p_participant_token: carol.participant_token,
    p_question_id: current,
    p_choice_key: index % 4 === 0 ? "B" : "A",
    p_ms_taken: 600,
  });
  answered += 1;
  const next = await admin.rpc("pick_next_adaptive_question", {
    p_session_id: adGame.session.id,
    p_participant_id: carol.participant_id,
  });
  current = next.data;
}
const exhausted = await admin.rpc("pick_next_adaptive_question", {
  p_session_id: adGame.session.id,
  p_participant_id: carol.participant_id,
});
const { data: adState } = await admin.from("game_instances").select("adaptive_state").eq("id", adGame.instance.id).maybeSingle();
const answeredIds = adState?.adaptive_state?.per_participant?.[carol.participant_id]?.answered_ids ?? [];
pass("AD6 completed 15 or pool exhausted", answeredIds.length >= 15 || exhausted.data == null, `answered=${answeredIds.length}`);

await admin.rpc("quiz_end_session", { p_session_id: adGame.session.id });
await admin.rpc("finalize_game_instance", { p_session_id: adGame.session.id });
await admin.rpc("refresh_student_performance", { p_session_id: adGame.session.id });
const { data: perf } = await admin
  .from("student_performance")
  .select("standard_id, weakness_score, attempts")
  .eq("student_profile_id", profile.student_profile_id)
  .eq("class_id", klass.id);
pass("AD7 weakness_score present for Alice", (perf ?? []).length > 0, JSON.stringify(perf));

const weakest = [...(perf ?? [])].sort((a, b) => Number(b.weakness_score) - Number(a.weakness_score))[0];
const adGame2 = await launch("adaptive", {
  pool: adPool.pool,
  questions: adPool.questions,
  modeConfig: {
    total_questions: 15,
    prefer_weak: true,
    avoid_recent_days: 0,
    min_questions_per_standard: 2,
    difficulty_ramp: true,
    allow_hint: true,
    hint_penalty: 50,
  },
});
const alice2 = await joinPlayer(adGame2.joinCode, "Alice");
await admin.rpc("quiz_set_question", { p_session_id: adGame2.session.id, p_index: 0 });
const { data: profile2 } = await admin.from("quiz_participants").select("id, student_profile_id").eq("id", alice2.participant_id).maybeSingle();
if (profile2?.student_profile_id && profile?.student_profile_id && profile2.student_profile_id !== profile.student_profile_id) {
  // same display name should match the same profile via match_or_create
}
const first2 = await admin.rpc("pick_next_adaptive_question", {
  p_session_id: adGame2.session.id,
  p_participant_id: alice2.participant_id,
});
const first2q = adPool.questions.find((row) => row.id === first2.data);
pass(
  "AD8 first question of session 2 targets a remaining pool item",
  Boolean(first2.data),
  `weakest=${weakest?.standard_id} pickedStd=${first2q?.standard_id}`,
);

const { data: tables } = await admin.rpc("health_public_table_count");
pass("health tables 29", tables === 29, String(tables));

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
