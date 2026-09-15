import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { insertRehearsalBots, runRehearsalTick } from "@/lib/games/rehearsal/bots.ts";
import { botDelayMs, parseRehearsalConfig, sliceQuestionIds } from "@/lib/games/rehearsal/types.ts";
import { filterInstances, includeRehearsal } from "@/lib/games/queries.ts";

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

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const host = readFileSync(join(process.cwd(), "app/quiz/host/[sessionId]/HostShell.tsx"), "utf8");
const banner = readFileSync(join(process.cwd(), "components/quiz/RehearsalBanner.tsx"), "utf8");
const detail = readFileSync(join(process.cwd(), "components/games/GameDetail.tsx"), "utf8");
const modal = readFileSync(join(process.cwd(), "components/games/RehearseModal.tsx"), "utf8");
const wizard = readFileSync(join(process.cwd(), "components/games/GameWizard.tsx"), "utf8");
const games = readFileSync(join(process.cwd(), "lib/data/games.ts"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260915010000_phase72_rehearsal.sql"), "utf8");
const tick = readFileSync(join(process.cwd(), "app/api/quiz/rehearsal/tick/route.ts"), "utf8");

pass("source Rehearse outline button", detail.includes("Rehearse") && detail.includes('variant="outline"'), "");
pass("source Rehearse modal title", modal.includes("Rehearse this game") && modal.includes("Start rehearsal"), "");
pass("source host rehearsal banner", host.includes("RehearsalBanner") && banner.includes("REHEARSAL MODE — no data will be saved."), "");
pass("source wizard Step 4 rehearsal copy", wizard.includes("You can rehearse this game before going live."), "");
pass("source overview tip flag", detail.includes("rehearsal_tip_dismissed"), "");
pass(
  "source list queries use filterInstances",
  games.includes("filterInstances") && games.includes("listTemplateInstances") && games.includes("listRecentEndedInstances"),
  "",
);
pass("source tick scheduler", tick.includes("runRehearsalTick"), "");
pass("source hard-delete RPC", migration.includes("end_rehearsal") && migration.includes("delete from public.game_instances"), "");
pass("source skip next to Next", host.includes("Skip →"), "");
pass("default includeRehearsal is false", includeRehearsal === false, String(includeRehearsal));

const filtered = [];
filterInstances({
  eq(column, value) {
    filtered.push([column, value]);
    return this;
  },
});
pass("filterInstances excludes rehearsal", filtered[0]?.[0] === "is_rehearsal" && filtered[0]?.[1] === false, JSON.stringify(filtered));
pass("slice first_5", sliceQuestionIds(["a", "b", "c", "d", "e", "f"], "first_5").length === 5, "");
pass("4x delay is faster than 1x", botDelayMs("bot", "q", "mixed", 4) < botDelayMs("bot", "q", "mixed", 1), "");

const MODES = ["jeopardy", "rapid_fire", "team_battle", "case_study", "adaptive", "boss_battle"];

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: standards } = await admin.from("standards").select("id").limit(3);
const { data: bosses } = await admin.from("bosses").select("id").is("deleted_at", null).limit(1);
const stamp = Date.now();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `7.2 rehearsal ${stamp}`, audience: "verify", created_by: userId })
  .select("id")
  .single();
if (classError) throw new Error(classError.message);

function questionRow(stem, extra = {}) {
  return {
    class_id: klass.id,
    stem,
    choices_json: [
      { key: "A", text: "Correct" },
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
    standard_id: standards?.[0]?.id ?? null,
    ...extra,
  };
}

async function makePool(name, count) {
  const { data: questions, error: qError } = await admin
    .from("questions")
    .insert(Array.from({ length: count }, (_, index) => questionRow(`${name} Q${index + 1}`)))
    .select("id");
  if (qError) throw new Error(qError.message);
  const { data: pool, error: pError } = await admin
    .from("question_pools")
    .insert({ class_id: klass.id, name, shuffle_on_play: false, time_per_q: 30 })
    .select("*")
    .single();
  if (pError) throw new Error(pError.message);
  await admin.from("question_pool_items").insert(questions.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));
  return { pool, questions };
}

async function countLive(templateId) {
  const { count, error } = await admin
    .from("game_instances")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("is_rehearsal", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function perfCount() {
  const { count, error } = await admin
    .from("student_performance")
    .select("id", { count: "exact", head: true })
    .eq("class_id", klass.id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function launchRehearsal(mode, questions, extra = {}) {
  const questionIds = questions.map((row) => row.id);
  const joinCode = `R${Math.random().toString(36).slice(2, 7)}`.slice(0, 6).toUpperCase();
  const timePerQ = mode === "rapid_fire" ? 60 : 5;
  const modeConfig = extra.modeConfig ?? {};
  const startMs = Date.now();
  const startedIso = new Date(startMs).toISOString();
  const settings = {
    allow_late_join: true,
    show_leaderboard: true,
    show_correct_answer: true,
    shuffle: false,
    question_ids: questionIds,
    host_token: crypto.randomUUID(),
    mode_config: { ...modeConfig, ...(mode === "rapid_fire" ? { total_time_seconds: 60 } : {}) },
    name: `${mode} rehearsal`,
    game_started_at: startedIso,
    question_started_at: startedIso,
  };
  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .insert({
      pool_id: extra.poolId ?? null,
      host_id: userId,
      mode,
      time_per_q: timePerQ,
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
  const { data: template, error: templateError } = await admin
    .from("game_templates")
    .insert({
      class_id: klass.id,
      owner_id: userId,
      name: `${mode} 7.2 ${stamp}`,
      mode,
      pool_id: extra.poolId ?? null,
      case_study_ids: extra.caseStudyIds ?? [],
      boss_id: extra.bossId ?? null,
      mode_config: modeConfig,
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
    .select("id, version, play_count")
    .single();
  if (templateError) throw new Error(templateError.message);
  const config = {
    bot_count: 3,
    bot_profiles: ["mixed"],
    fast_forward: true,
    time_multiplier: 1,
    question_scope: "all",
    bots: [],
  };
  const { data: instance, error: instanceError } = await admin
    .from("game_instances")
    .insert({
      template_id: template.id,
      template_version: template.version,
      host_id: userId,
      quiz_session_id: session.id,
      join_code: joinCode,
      status: "lobby",
      team_assignment_mode: mode === "team_battle" ? "auto" : "auto",
      settings_snapshot: { mode, question_ids: questionIds, mode_config: modeConfig },
      is_rehearsal: true,
      rehearsal_config: config,
    })
    .select("id, is_rehearsal, rehearsal_config")
    .single();
  if (instanceError) throw new Error(instanceError.message);
  if (mode === "team_battle") {
    const { error } = await admin.rpc("quiz_ensure_teams", { p_session_id: session.id });
    if (error) throw new Error(error.message);
  }
  if (mode === "boss_battle") {
    const { error } = await admin.rpc("init_boss_combat", { p_session_id: session.id });
    if (error) throw new Error(error.message);
  }
  const bots = await insertRehearsalBots(admin, session.id, instance.id, parseRehearsalConfig(config));
  const tickQuestions = questions.map((row) => ({
    question_id: row.id,
    answer_key: "A",
    choices: [
      { key: "A" },
      { key: "B" },
      { key: "C" },
      { key: "D" },
    ],
  }));
  return { session, instance, template, questionIds, tickQuestions, bots, timePerQ, startMs };
}

for (const mode of MODES) {
  const prefix = mode;
  let questions;
  let extra = {};
  if (mode === "case_study") {
    const { data: caseRow, error: caseError } = await admin
      .from("case_studies")
      .insert({
        class_id: klass.id,
        title: `Rehearsal case ${stamp}`,
        scenario_text: "A client offers World Series tickets during a due-diligence visit.",
        created_by: userId,
      })
      .select("id")
      .single();
    if (caseError) throw new Error(caseError.message);
    const { data: caseQs, error: qError } = await admin
      .from("questions")
      .insert(Array.from({ length: 5 }, (_, index) => questionRow(`${mode} Q${index + 1}`)))
      .select("id");
    if (qError) throw new Error(qError.message);
    for (let index = 0; index < caseQs.length; index += 1) {
      await admin.from("questions").update({ case_study_id: caseRow.id, case_study_order: index }).eq("id", caseQs[index].id);
    }
    questions = caseQs;
    extra = {
      caseStudyIds: [caseRow.id],
      modeConfig: { show_scenario_before_each_question: false, min_case_size: 3, max_case_size: 8, base_points: 100 },
    };
  } else {
    const pool = await makePool(`${mode} pool ${stamp}`, 5);
    questions = pool.questions;
    extra = {
      poolId: pool.pool.id,
      modeConfig:
        mode === "rapid_fire"
          ? { total_time_seconds: 60, questions_unlimited: true, wrong_answer_penalty: 0 }
          : mode === "adaptive"
            ? { total_questions: 5 }
            : mode === "boss_battle"
              ? { base_damage: 40 }
              : { base_points: 100, time_bonus: true, streak_bonus: true, team_count: 4 },
      bossId: mode === "boss_battle" ? bosses?.[0]?.id : null,
    };
  }

  const liveBefore = await countLive("00000000-0000-0000-0000-000000000000").catch(() => 0);
  void liveBefore;
  const game = await launchRehearsal(mode, questions, extra);
  const liveAtStart = await countLive(game.template.id);
  const perfBefore = await perfCount();
  const { data: tpl } = await admin.from("game_templates").select("play_count").eq("id", game.template.id).single();

  pass(`${prefix} 1 create game with 5 questions`, game.questionIds.length === 5, String(game.questionIds.length));
  pass(`${prefix} 2 Rehearse created instance`, Boolean(game.instance?.id), game.instance?.id ?? "");
  const cfg = parseRehearsalConfig(game.instance.rehearsal_config);
  pass(
    `${prefix} 3 configure 3 mixed bots, fast-forward on`,
    cfg.bot_count === 3 && cfg.fast_forward === true && (cfg.bot_profiles === "random" || cfg.bot_profiles.includes("mixed")),
    JSON.stringify({ bot_count: cfg.bot_count, profiles: cfg.bot_profiles, fast_forward: cfg.fast_forward, time_per_q: game.timePerQ }),
  );
  pass(
    `${prefix} 4 host dashboard rehearsal banner`,
    game.instance.is_rehearsal === true && banner.includes("REHEARSAL MODE — no data will be saved.") && host.includes("RehearsalBanner"),
    String(game.instance.is_rehearsal),
  );

  const { data: bots } = await admin
    .from("quiz_participants")
    .select("id, display_name, is_bot, student_profile_id, score")
    .eq("session_id", game.session.id)
    .eq("is_bot", true);
  pass(`${prefix} 5 3 bots join automatically`, (bots ?? []).length === 3 && (bots ?? []).every((row) => row.is_bot && !row.student_profile_id), String((bots ?? []).length));

  const first = game.tickQuestions[0];
  const sampleBot = game.bots[0];
  const delay = botDelayMs(sampleBot.participant_id, first.question_id, "mixed", 1);
  const early = await runRehearsalTick(admin, game.session.id, {
    now: game.startMs + 250,
    questions: game.tickQuestions,
    mode,
  });
  const late = await runRehearsalTick(admin, game.session.id, {
    now: game.startMs + 25_000,
    questions: game.tickQuestions,
    mode,
  });
  const { data: responses } = await admin
    .from("quiz_responses")
    .select("id, participant_id, question_id, is_correct, points_earned")
    .eq("session_id", game.session.id)
    .is("deleted_at", null);
  pass(
    `${prefix} 6 bots answer with delays`,
    early.submitted === 0 && late.submitted >= 1 && (responses ?? []).length >= 1,
    JSON.stringify({ delay, early: early.submitted, late: late.submitted, responses: (responses ?? []).length, errors: [...early.errors, ...late.errors] }),
  );

  const { data: scored } = await admin
    .from("quiz_participants")
    .select("id, score, is_bot")
    .eq("session_id", game.session.id)
    .eq("is_bot", true)
    .order("score", { ascending: false });
  pass(`${prefix} 7 leaderboard populates`, (scored ?? []).length === 3, JSON.stringify((scored ?? []).map((row) => row.score)));

  const independent = mode === "rapid_fire" || mode === "adaptive";
  let revealOk = (responses ?? []).some((row) => row.is_correct !== null);
  if (!independent) {
    const { error: revealError } = await admin.rpc("quiz_apply_reveal", {
      p_session_id: game.session.id,
      p_question_id: first.question_id,
      p_correct_key: "A",
    });
    const { data: revealed } = await admin.from("quiz_sessions").select("reveal_answer").eq("id", game.session.id).single();
    revealOk = !revealError && revealed?.reveal_answer === true;
    pass(`${prefix} 8 reveal works`, revealOk, revealError?.message ?? "");
  } else {
    pass(`${prefix} 8 reveal works`, revealOk, `independent mode; scored rows=${(responses ?? []).filter((row) => row.is_correct !== null).length}`);
  }

  await admin.rpc("refresh_student_performance", { p_session_id: game.session.id });
  await admin.rpc("finalize_game_instance", { p_session_id: game.session.id });
  const botIds = (bots ?? []).map((row) => row.id);
  const { data: perfForBots } = await admin
    .from("student_performance")
    .select("id, student_profile_id")
    .eq("class_id", klass.id);
  const { data: tplAfter } = await admin.from("game_templates").select("play_count").eq("id", game.template.id).single();
  pass(`${prefix} 11 student_performance unchanged for bots`, (perfForBots ?? []).length === perfBefore && tplAfter.play_count === tpl.play_count, `perf ${perfBefore}->${(perfForBots ?? []).length} play_count ${tpl.play_count}->${tplAfter.play_count} bots ${botIds.length}`);

  const { error: endError } = await admin.rpc("end_rehearsal", { p_instance_id: game.instance.id });
  const { data: gone } = await admin.from("game_instances").select("id").eq("id", game.instance.id);
  const { data: leftoverPeople } = await admin.from("quiz_participants").select("id").eq("session_id", game.session.id);
  pass(`${prefix} 9 end rehearsal hard-deletes instance`, !endError && (gone ?? []).length === 0, endError?.message ?? `rows=${(gone ?? []).length}`);
  const liveAfter = await countLive(game.template.id);
  pass(`${prefix} 10 game_instances live count unchanged`, liveAfter === liveAtStart && liveAfter === 0, `before=${liveAtStart} after=${liveAfter}`);
  const { data: listed } = await admin
    .from("game_instances")
    .select("id")
    .eq("template_id", game.template.id)
    .eq("is_rehearsal", false);
  pass(`${prefix} 12 session list shows 0`, (listed ?? []).length === 0 && (leftoverPeople ?? []).length === 0, String((listed ?? []).length));
}

const livePool = await makePool(`live regression ${stamp}`, 5);
const joinCode = `L${Math.random().toString(36).slice(2, 7)}`.slice(0, 6).toUpperCase();
const { data: liveSession, error: liveSessionError } = await admin
  .from("quiz_sessions")
  .insert({
    pool_id: livePool.pool.id,
    host_id: userId,
    mode: "jeopardy",
    time_per_q: 30,
    status: "live",
    join_code: joinCode,
    current_question_index: 0,
    started_at: new Date().toISOString(),
    reveal_answer: false,
    settings_json: { question_ids: livePool.questions.map((row) => row.id), host_token: crypto.randomUUID() },
  })
  .select("id")
  .single();
if (liveSessionError) throw new Error(liveSessionError.message);
const { data: liveTemplate } = await admin
  .from("game_templates")
  .insert({
    class_id: klass.id,
    owner_id: userId,
    name: `live 7.2 ${stamp}`,
    mode: "jeopardy",
    pool_id: livePool.pool.id,
    settings_json: { time_per_q: 30, base_points: 100 },
  })
  .select("id, version")
  .single();
const { error: liveInstanceError } = await admin.from("game_instances").insert({
  template_id: liveTemplate.id,
  template_version: liveTemplate.version,
  host_id: userId,
  quiz_session_id: liveSession.id,
  join_code: joinCode,
  status: "lobby",
  is_rehearsal: false,
});
pass("live games still insert without rehearsal", !liveInstanceError, liveInstanceError?.message ?? "");
const { data: liveListed } = await admin
  .from("game_instances")
  .select("id, is_rehearsal")
  .eq("template_id", liveTemplate.id)
  .eq("is_rehearsal", false);
pass("live session appears in filtered list", (liveListed ?? []).length === 1, String((liveListed ?? []).length));

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((row) => row.step).join("\n"));
  process.exit(1);
}
