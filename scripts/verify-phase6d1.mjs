import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getMode, listModes } from "@/lib/games/modes/registry.ts";
import { scoreQuestion } from "@/lib/quiz/scoring.ts";
import { teamStandings } from "@/lib/games/modes/team-score.ts";

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

const jeopardy = getMode("jeopardy").scoreResponse({
  isCorrect: true,
  msTaken: 0,
  timeLimitMs: 30000,
  basePoints: 100,
  priorCorrect: 2,
});
pass("plugin jeopardy 0ms streak2", jeopardy.points === 240, String(jeopardy.points));
pass("scoreQuestion wrapper still 240", scoreQuestion(0, 30, 2, true).points === 240, "");
const rfCorrect = getMode("rapid_fire").scoreResponse({
  isCorrect: true,
  msTaken: 10,
  timeLimitMs: 60000,
  basePoints: 100,
  priorCorrect: 3,
  wrongPenalty: 0,
});
pass("plugin rapid fire no streak", rfCorrect.points === 100, String(rfCorrect.points));
const rfWrong = getMode("rapid_fire").scoreResponse({
  isCorrect: false,
  msTaken: 10,
  timeLimitMs: 60000,
  basePoints: 100,
  priorCorrect: 0,
  wrongPenalty: 25,
});
pass("plugin rapid fire penalty", rfWrong.points === -25, String(rfWrong.points));
pass(
  "registry playable",
  listModes().filter((mode) => mode.status === "playable").map((mode) => mode.id).join() ===
    "jeopardy,rapid_fire,team_battle,case_study,adaptive,boss_battle",
  "",
);

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const stamp = Date.now();
const { data: klass } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `6D.1 ${stamp}`, audience: "verify", created_by: userId })
  .select("id")
  .single();

function questionRow(stem) {
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
  };
}

async function makePool(name, count) {
  const { data: questions } = await admin
    .from("questions")
    .insert(Array.from({ length: count }, (_, index) => questionRow(`${name} Q${index + 1}`)))
    .select("id");
  const { data: pool } = await admin
    .from("question_pools")
    .insert({ class_id: klass.id, name, shuffle_on_play: false, time_per_q: 30 })
    .select("*")
    .single();
  await admin.from("question_pool_items").insert(questions.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));
  return { pool, questions };
}

async function launch(mode, pool, questions, modeConfig, extraSettings = {}) {
  const questionIds = questions.map((row) => row.id);
  const joinCode = `D${Math.random().toString(36).slice(2, 7)}`.slice(0, 6).toUpperCase();
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
      pool_id: pool.id,
      host_id: userId,
      mode,
      time_per_q: mode === "rapid_fire" ? Number(modeConfig.total_time_seconds ?? 60) : 30,
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
      pool_id: pool.id,
      mode_config: modeConfig,
      settings_json: { time_per_q: 30, base_points: 100, time_bonus: true, streak_bonus: true, shuffle_questions: false, show_leaderboard_to_players: true, show_correct_answer_after: true, allow_late_join: true, allow_audience_advance: false },
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
      team_assignment_mode: modeConfig.team_assignment_mode ?? "auto",
      settings_snapshot: { mode, question_ids: questionIds, mode_config: modeConfig },
    })
    .select("id")
    .single();
  if (instanceError) throw new Error(instanceError.message);
  if (mode === "team_battle") {
    await admin.rpc("quiz_ensure_teams", { p_session_id: session.id });
  }
  return { session, instance, joinCode, questionIds, settings };
}

async function joinPlayer(code, name) {
  const { data, error } = await pub.rpc("join_game_by_code", {
    p_join_code: code,
    p_display_name: name,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

// Rapid Fire E2E
const rfPool = await makePool("RF pool", 15);
const rfGame = await launch("rapid_fire", rfPool.pool, rfPool.questions, {
  total_time_seconds: 60,
  questions_unlimited: true,
  questions_max: 30,
  wrong_answer_penalty: 0,
  score_per_correct: 100,
});
pass("RF1 create 15q 60s", rfGame.questionIds.length === 15 && rfGame.session.mode === "rapid_fire", rfGame.session.id);

const alice = await joinPlayer(rfGame.joinCode, "Alice RF");
const bob = await joinPlayer(rfGame.joinCode, "Bob RF");
pass("RF2 two players join", Boolean(alice?.participant_token && bob?.participant_token), "");

const tooSoon = await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: rfGame.questionIds[0],
  p_choice_key: "A",
  p_ms_taken: 100,
});
pass("RF lobby blocked until start", Boolean(tooSoon.error), tooSoon.error?.message ?? "no error");

await admin.rpc("quiz_set_question", { p_session_id: rfGame.session.id, p_index: 0 });
const { data: started } = await admin.from("quiz_sessions").select("settings_json").eq("id", rfGame.session.id).single();
pass("RF3 clock started", Boolean(started.settings_json.game_started_at), started.settings_json.game_started_at);

const a1 = await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: rfGame.questionIds[0],
  p_choice_key: "A",
  p_ms_taken: 200,
});
const a1row = Array.isArray(a1.data) ? a1.data[0] : a1.data;
pass("RF4 Alice Q1 instant score", a1row?.ok === true && a1row?.is_correct === true && a1row?.points === 100, JSON.stringify(a1row));

const a2 = await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: rfGame.questionIds[1],
  p_choice_key: "B",
  p_ms_taken: 150,
});
const a2row = Array.isArray(a2.data) ? a2.data[0] : a2.data;
pass("RF4 Alice Q2 independent", a2row?.ok === true && a2row?.is_correct === false && a2row?.points === 0, JSON.stringify(a2row));

const b1 = await pub.rpc("submit_answer", {
  p_participant_token: bob.participant_token,
  p_question_id: rfGame.questionIds[0],
  p_choice_key: "A",
  p_ms_taken: 400,
});
const b1row = Array.isArray(b1.data) ? b1.data[0] : b1.data;
pass("RF5 Bob independent Q1", b1row?.ok === true && b1row?.is_correct === true, JSON.stringify(b1row));

const b2 = await pub.rpc("submit_answer", {
  p_participant_token: bob.participant_token,
  p_question_id: rfGame.questionIds[1],
  p_choice_key: "A",
  p_ms_taken: 100,
});
pass("RF5 Bob independent Q2", b2.data?.[0]?.ok === true, JSON.stringify(b2.data?.[0]));

await admin
  .from("quiz_sessions")
  .update({
    settings_json: { ...started.settings_json, game_started_at: new Date(Date.now() - 70_000).toISOString() },
  })
  .eq("id", rfGame.session.id);
const frozen = await pub.rpc("submit_answer", {
  p_participant_token: alice.participant_token,
  p_question_id: rfGame.questionIds[2],
  p_choice_key: "A",
  p_ms_taken: 100,
});
pass("RF6 clock 0 freezes", Boolean(frozen.error) && /clock/i.test(frozen.error.message), frozen.error?.message ?? "no error");

const { data: rfPlayers } = await admin
  .from("quiz_participants")
  .select("display_name, score")
  .eq("session_id", rfGame.session.id)
  .is("deleted_at", null);
const aliceRow = rfPlayers.find((row) => row.display_name === "Alice RF");
const bobRow = rfPlayers.find((row) => row.display_name === "Bob RF");
pass("RF7 host totals", aliceRow?.score === 100 && bobRow?.score === 200, JSON.stringify(rfPlayers));

const { data: rfResponses } = await admin
  .from("quiz_responses")
  .select("participant_id, is_correct")
  .eq("session_id", rfGame.session.id);
const aliceCorrect = rfResponses.filter((row) => row.participant_id === alice.participant_id && row.is_correct).length;
pass("RF7 total correct Alice", aliceCorrect === 1, String(aliceCorrect));

// Team Battle E2E
const tbPool = await makePool("TB pool", 10);
const tb = await launch("team_battle", tbPool.pool, tbPool.questions, {
  team_count: 4,
  team_assignment_mode: "auto",
  base_points: 100,
  time_bonus: true,
  streak_bonus: true,
  team_bonus_per_member: 20,
});
pass("TB1 create 10q 4 teams", tb.session.mode === "team_battle", tb.session.id);
const { data: tbTeams } = await admin.from("game_teams").select("*").eq("instance_id", tb.instance.id);
pass("TB1 four teams", tbTeams.length === 4, tbTeams.map((row) => row.team_key).join());

const names = ["P1", "P2", "P3", "P4"];
const players = [];
for (const name of names) players.push(await joinPlayer(tb.joinCode, name));
const { data: assigned } = await admin
  .from("quiz_participants")
  .select("display_name, team_id")
  .eq("session_id", tb.session.id)
  .is("deleted_at", null);
const keys = assigned.map((row) => row.team_id).sort();
pass("TB2 round-robin", new Set(keys).size === 4, keys.join());

const p1 = assigned.find((row) => row.display_name === "P1");
const other = tbTeams.find((team) => team.team_key !== p1.team_id);
await admin.rpc("quiz_reassign_team", {
  p_session_id: tb.session.id,
  p_participant_id: players[0].participant_id,
  p_team_key: other.team_key,
});
const { data: moved } = await admin.from("quiz_participants").select("team_id").eq("id", players[0].participant_id).single();
pass("TB3 host reassign", moved.team_id === other.team_key, moved.team_id);

await admin.rpc("quiz_set_question", { p_session_id: tb.session.id, p_index: 0 });
for (const player of players) {
  await pub.rpc("submit_answer", {
    p_participant_token: player.participant_token,
    p_question_id: tb.questionIds[0],
    p_choice_key: "A",
    p_ms_taken: 1000,
  });
}
await admin.rpc("quiz_apply_reveal", {
  p_session_id: tb.session.id,
  p_question_id: tb.questionIds[0],
  p_correct_key: "A",
});
const { data: tbPlayers } = await admin
  .from("quiz_participants")
  .select("id, display_name, score, team_id")
  .eq("session_id", tb.session.id);
const { data: tbResponses } = await admin
  .from("quiz_responses")
  .select("participant_id, is_correct")
  .eq("session_id", tb.session.id);
const standings = teamStandings(tbTeams, tbPlayers, tbResponses, 20);
pass("TB5 team bonus 20 per correct", standings.reduce((sum, team) => sum + team.score, 0) === 80, JSON.stringify(standings.map((t) => ({ k: t.team_key, s: t.score }))));
pass("TB6 color chips", standings.every((team) => team.color && team.name), "");
const mvp = [...tbPlayers].sort((a, b) => b.score - a.score)[0];
pass("TB7 MVP individual", Boolean(mvp?.display_name) && mvp.score > 0, `${mvp?.display_name} ${mvp?.score}`);
const winner = standings[0];
pass("TB7 winning team", Boolean(winner?.name), `${winner?.name} ${winner?.score}`);

// Jeopardy regression
const jqPool = await makePool("JQ pool", 3);
const jq = await launch("jeopardy", jqPool.pool, jqPool.questions, {
  time_per_q: 30,
  base_points: 100,
  time_bonus: true,
  streak_bonus: true,
});
const jAlice = await joinPlayer(jq.joinCode, "Jeopardy Alice");
await admin.rpc("quiz_set_question", { p_session_id: jq.session.id, p_index: 0 });
await pub.rpc("submit_answer", {
  p_participant_token: jAlice.participant_token,
  p_question_id: jq.questionIds[0],
  p_choice_key: "A",
  p_ms_taken: 0,
});
await admin.rpc("quiz_apply_reveal", {
  p_session_id: jq.session.id,
  p_question_id: jq.questionIds[0],
  p_correct_key: "A",
});
const { data: jPlayer } = await admin.from("quiz_participants").select("score").eq("id", jAlice.participant_id).single();
pass("Jeopardy still 200 at 0ms streak0", jPlayer.score === 200, String(jPlayer.score));

const { data: tables } = await admin.rpc("health_public_table_count");
pass("health tables 30", tables === 30, String(tables));

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
