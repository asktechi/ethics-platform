import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getMode, listModes } from "@/lib/games/modes/registry.ts";
import { computeBossDamage, DEFAULT_BOSS_CONFIG, phaseFromHp } from "@/lib/games/boss-combat.ts";
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
pass("all 6 modes playable", playable.join() === "jeopardy,rapid_fire,team_battle,case_study,adaptive,boss_battle", playable.join());
assertPlayableMode("boss_battle");
pass("boss_battle save allowed", true, "");

const dmg = computeBossDamage({
  isCorrect: true,
  msTaken: 0,
  timeLimitMs: 30000,
  priorCorrect: 0,
  difficulty: "medium",
  config: DEFAULT_BOSS_CONFIG,
});
pass("plugin medium 0ms no streak = 70", dmg.damage === 70, String(dmg.damage));
const streak2 = computeBossDamage({
  isCorrect: true,
  msTaken: 30000,
  timeLimitMs: 30000,
  priorCorrect: 3,
  difficulty: "easy",
  config: DEFAULT_BOSS_CONFIG,
});
pass("plugin easy full-time prior3 = 80 x2", streak2.damage === 80 && streak2.multiplier === 2, JSON.stringify(streak2));
const miss = computeBossDamage({
  isCorrect: false,
  msTaken: 1000,
  timeLimitMs: 30000,
  priorCorrect: 0,
  config: DEFAULT_BOSS_CONFIG,
});
pass("plugin miss heals", miss.bonusReason === "boss_healed" && miss.damage === 0, miss.bonusReason);
pass("phase 70% is 1", phaseFromHp(245, 350, true) === 1, "");
pass("phase 53% is 2", phaseFromHp(185, 350, true) === 2, "");
pass("phase 30% is 3", phaseFromHp(105, 350, true) === 3, "");

const wizardSource = readFileSync(join(process.cwd(), "components/games/GameWizard.tsx"), "utf8");
pass("wizard has boss selector", wizardSource.includes("Pick a boss") && wizardSource.includes("BossRules"), "");
pass("coming soon badge code remains for unplayable", wizardSource.includes("Coming soon"), "");

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: standards } = await admin.from("standards").select("id, code, title");
const stamp = Date.now();
const { data: klass } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `6D.3 ${stamp}`, audience: "verify", created_by: userId })
  .select("id")
  .single();

const { data: bosses, error: bossError } = await admin
  .from("bosses")
  .select("id, slug, name, max_hp, standard_id, victory_line, defeat_line, standard:standards(code)")
  .is("deleted_at", null)
  .order("slug");
if (bossError) throw new Error(bossError.message);
pass("5 seeded bosses", bosses.length === 5, bosses.map((row) => row.slug).join());
const expected = {
  insider_phantom: { name: "The Insider Phantom", hp: 350, code: "II(A)" },
  market_manipulator: { name: "The Market Manipulator", hp: 400, code: "II(B)" },
  conflict_hydra: { name: "The Conflict Hydra", hp: 500, code: "VI" },
  suitability_shade: { name: "The Suitability Shade", hp: 350, code: "III(C)" },
  corpus_impostor: { name: "The Corpus Impostor", hp: 400, code: "I(C)" },
};
for (const [slug, meta] of Object.entries(expected)) {
  const row = bosses.find((item) => item.slug === slug);
  const code = Array.isArray(row?.standard) ? row.standard[0]?.code : row?.standard?.code;
  pass(
    `boss ${slug}`,
    Boolean(row) && row.name === meta.name && row.max_hp === meta.hp && code === meta.code,
    `${row?.name} ${row?.max_hp} ${code}`,
  );
}
const phantom = bosses.find((row) => row.slug === "insider_phantom");

function questionRow(stem, difficulty = "easy") {
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
    standard_id: phantom.standard_id ?? standards.find((item) => item.code === "II(A)")?.id ?? null,
    difficulty,
  };
}

async function makePool(name, count) {
  const rows = Array.from({ length: count }, (_, index) => questionRow(`${name} Q${index + 1}`));
  const { data: questions, error } = await admin.from("questions").insert(rows).select("id");
  if (error) throw new Error(error.message);
  const { data: pool } = await admin
    .from("question_pools")
    .insert({ class_id: klass.id, name, shuffle_on_play: false, time_per_q: 30 })
    .select("*")
    .single();
  await admin.from("question_pool_items").insert(questions.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));
  return { pool, questions };
}

async function launch(name, { pool, questions, modeConfig, bossId }) {
  const questionIds = questions.map((row) => row.id);
  const joinCode = `B${Math.random().toString(36).slice(2, 7)}`.slice(0, 6).toUpperCase();
  const settings = {
    allow_late_join: true,
    show_leaderboard: true,
    show_correct_answer: true,
    shuffle: false,
    question_ids: questionIds,
    host_token: crypto.randomUUID(),
    mode_config: modeConfig,
    name,
  };
  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .insert({
      pool_id: pool.id,
      host_id: userId,
      mode: "boss_battle",
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
  const { data: template, error: templateError } = await admin
    .from("game_templates")
    .insert({
      class_id: klass.id,
      owner_id: userId,
      name,
      mode: "boss_battle",
      pool_id: pool.id,
      boss_id: bossId,
      boss_config: modeConfig,
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
    .select("id, version")
    .single();
  if (templateError) throw new Error(templateError.message);
  const { error: instanceError } = await admin.from("game_instances").insert({
    template_id: template.id,
    template_version: template.version,
    host_id: userId,
    quiz_session_id: session.id,
    join_code: joinCode,
    status: "lobby",
    settings_snapshot: { mode: "boss_battle", question_ids: questionIds, mode_config: modeConfig, boss_id: bossId },
  });
  if (instanceError) throw new Error(instanceError.message);
  return { session, joinCode, questionIds, template };
}

async function joinPlayer(code, name) {
  const { data, error } = await pub.rpc("join_game_by_code", {
    p_join_code: code,
    p_display_name: name,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}

async function playQuestion(sessionId, questionId, answers, index = 0) {
  const { error: setError } = await admin.rpc("quiz_set_question", { p_session_id: sessionId, p_index: index });
  if (setError) throw new Error(setError.message);
  for (const answer of answers) {
    const { error } = await pub.rpc("submit_answer", {
      p_participant_token: answer.token,
      p_question_id: questionId,
      p_choice_key: answer.key,
      p_ms_taken: answer.ms ?? 30000,
    });
    if (error) throw new Error(error.message);
  }
  const { error } = await admin.rpc("quiz_apply_reveal", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_correct_key: "A",
  });
  if (error) throw new Error(error.message);
  const { data } = await admin.rpc("get_boss_combat", { p_session_id: sessionId });
  return data;
}

const coopConfig = {
  mode: "co-op",
  base_damage: 40,
  time_bonus_damage: 20,
  wrong_answer_penalty: "boss_heal",
  boss_heal_amount: 15,
  party_damage_amount: 20,
  party_max_hp: 300,
  streak_damage_multiplier: true,
  phases_enabled: true,
};

const coopPool = await makePool("Boss co-op", 10);
const coop = await launch("Insider Phantom co-op", {
  pool: coopPool.pool,
  questions: coopPool.questions,
  modeConfig: coopConfig,
  bossId: phantom.id,
});
pass("1 create co-op Insider Phantom 10q", Boolean(coop.session.id), coop.joinCode);

const alice = await joinPlayer(coop.joinCode, "Alice");
const bob = await joinPlayer(coop.joinCode, "Bob");
pass("2 two players joined", Boolean(alice.participant_token && bob.participant_token), "");

const { data: initRows, error: initError } = await admin.rpc("init_boss_combat", { p_session_id: coop.session.id });
const init = Array.isArray(initRows) ? initRows[0] : initRows;
pass("3 init HP 350/300 phase 1", !initError && init.boss_hp === 350 && init.party_hp === 300 && init.phase === 1, JSON.stringify(init));

const q = coopPool.questions;
const after1 = await playQuestion(coop.session.id, q[0].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 0);
const log1 = after1.log ?? [];
pass(
  "4 Q1 correct drops HP + combat log",
  after1.boss_hp === 310 && after1.phase === 1 && log1.some((row) => row.kind === "damage" && row.name === "Alice" && row.amount === 40),
  JSON.stringify({ hp: after1.boss_hp, log: log1.slice(-1) }),
);

const after2 = await playQuestion(coop.session.id, q[1].id, [{ token: alice.participant_token, key: "B", ms: 30000 }], 1);
pass(
  "5 Q2 wrong heals 15",
  after2.boss_hp === 325 && (after2.log ?? []).some((row) => row.kind === "heal" && row.amount === 15),
  JSON.stringify({ hp: after2.boss_hp, last: (after2.log ?? []).slice(-1) }),
);

const after3 = await playQuestion(coop.session.id, q[2].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 2);
const after4 = await playQuestion(coop.session.id, q[3].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 3);
const after5 = await playQuestion(coop.session.id, q[4].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 4);
const after6 = await playQuestion(coop.session.id, q[5].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 5);
const x2 = (after6.log ?? []).some((row) => row.kind === "damage" && Number(row.multiplier) === 2 && row.amount === 80);
pass("6 three-then-x2 streak (4th consecutive ×2)", x2 && after6.boss_hp === 105, JSON.stringify({ hp: after6.boss_hp, last: (after6.log ?? []).slice(-2) }));
pass("7 phase 2 at <66%", after5.phase === 2 && after5.boss_hp === 185 && Boolean(after5.taunt), `hp=${after5.boss_hp} phase=${after5.phase} taunt=${after5.taunt}`);
pass("8 phase 3 at <33%", after6.phase === 3 && after6.boss_hp === 105, `hp=${after6.boss_hp} phase=${after6.phase}`);

const after7 = await playQuestion(coop.session.id, q[6].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 6);
const after8 = await playQuestion(coop.session.id, q[7].id, [{ token: alice.participant_token, key: "A", ms: 30000 }], 7);
pass("9 victory at 0 HP", after8.outcome === "victory" && after8.boss_hp === 0, JSON.stringify({ hp: after8.boss_hp, outcome: after8.outcome, q7: after7.boss_hp }));

const { data: instance } = await admin
  .from("game_instances")
  .select("boss_hp_current, party_hp_current, boss_phase")
  .eq("quiz_session_id", coop.session.id)
  .maybeSingle();
pass(
  "10 instance hp columns",
  instance.boss_hp_current === 0 && instance.party_hp_current >= 0 && instance.boss_phase === 3,
  JSON.stringify(instance),
);

const defeatPool = await makePool("Boss defeat", 4);
const defeat = await launch("Defeat run", {
  pool: defeatPool.pool,
  questions: defeatPool.questions,
  modeConfig: { ...coopConfig, wrong_answer_penalty: "party_damage", party_max_hp: 20, party_damage_amount: 20 },
  bossId: phantom.id,
});
const dAlice = await joinPlayer(defeat.joinCode, "Alice");
const dBob = await joinPlayer(defeat.joinCode, "Bob");
await admin.rpc("init_boss_combat", { p_session_id: defeat.session.id });
const defeated = await playQuestion(defeat.session.id, defeatPool.questions[0].id, [
  { token: dAlice.participant_token, key: "B", ms: 1000 },
  { token: dBob.participant_token, key: "B", ms: 1000 },
]);
pass("D1 party HP drops on wrong", defeated.party_hp === 0, JSON.stringify({ party: defeated.party_hp, outcome: defeated.outcome }));
pass("D2 defeat screen state", defeated.outcome === "defeat", defeated.outcome);
pass("D3 defeat line present, no victory podium", Boolean(defeated.boss?.defeat_line) && defeated.outcome !== "victory", defeated.boss?.defeat_line ?? "");

const soloPool = await makePool("Boss solo", 10);
const solo = await launch("Solo run", {
  pool: soloPool.pool,
  questions: soloPool.questions,
  modeConfig: { ...coopConfig, mode: "solo" },
  bossId: phantom.id,
});
const sAlice = await joinPlayer(solo.joinCode, "Solo");
const { data: soloInitRows } = await admin.rpc("init_boss_combat", { p_session_id: solo.session.id });
const soloInit = Array.isArray(soloInitRows) ? soloInitRows[0] : soloInitRows;
pass("S1 party HP hidden (null)", soloInit.party_hp == null, JSON.stringify(soloInit));
let soloState = null;
for (let index = 0; index < 10; index += 1) {
  soloState = await playQuestion(solo.session.id, soloPool.questions[index].id, [
    { token: sAlice.participant_token, key: "A", ms: 0 },
  ], index);
  if (soloState.outcome === "victory") break;
}
pass("S2 solo victory kills boss", soloState?.outcome === "victory" && soloState.boss_hp === 0, JSON.stringify({ hp: soloState?.boss_hp, outcome: soloState?.outcome }));

const { data: tables } = await admin.rpc("health_public_table_count");
pass("health tables 30", tables === 30, String(tables));

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
