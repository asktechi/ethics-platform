import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

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

function poolerUrl(direct) {
  try {
    const parsed = new URL(direct);
    if (!parsed.hostname.startsWith("db.")) return direct;
    const ref = parsed.hostname.split(".")[1];
    parsed.hostname = "aws-0-us-east-2.pooler.supabase.com";
    parsed.port = "5432";
    parsed.username = `postgres.${ref}`;
    return parsed.toString();
  } catch {
    return direct;
  }
}

async function applyMigration() {
  const client = new pg.Client({
    connectionString: poolerUrl(process.env.SUPABASE_DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const existing = await client.query("select to_regclass('public.game_templates') as t");
    if (existing.rows[0]?.t) {
      pass("apply game library migration", true, "already applied");
      return;
    }
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260914010000_game_library.sql"), "utf8");
    await client.query(sql);
    pass("apply game library migration", true, "ok");
  } catch (error) {
    pass("apply game library migration", false, error.message);
    throw error;
  } finally {
    await client.end();
  }
}

await applyMigration();

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: klass } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `6C ${Date.now()}`, audience: "verify", created_by: userId })
  .select("id")
  .single();

const extras = Array.from({ length: 5 }, (_, index) => ({
  class_id: klass.id,
  stem: `6C Q${index + 1}`,
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
}));
const { data: qs } = await admin.from("questions").insert(extras).select("id");
const { data: pool } = await admin
  .from("question_pools")
  .insert({ class_id: klass.id, name: "6C Pool", shuffle_on_play: false, time_per_q: 30 })
  .select("*")
  .single();
await admin.from("question_pool_items").insert(qs.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));

const settingsV1 = {
  time_per_q: 30,
  base_points: 100,
  time_bonus: true,
  streak_bonus: true,
  shuffle_questions: false,
  show_leaderboard_to_players: true,
  show_correct_answer_after: true,
  allow_late_join: true,
  allow_audience_advance: false,
};
const { data: template, error: templateError } = await admin
  .from("game_templates")
  .insert({
    class_id: klass.id,
    owner_id: userId,
    name: "6C Jeopardy",
    description: "Verify template",
    tags: ["verify"],
    mode: "jeopardy",
    pool_id: pool.id,
    settings_json: settingsV1,
    version: 1,
  })
  .select("*")
  .single();
if (templateError) throw new Error(templateError.message);
pass("create template v1", template.version === 1, `v${template.version}`);

const joinCode = `C6${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6);
const hostToken = crypto.randomUUID();
const questionIds = qs.map((row) => row.id);
const { data: session } = await admin
  .from("quiz_sessions")
  .insert({
    pool_id: pool.id,
    host_id: userId,
    mode: "jeopardy",
    time_per_q: 30,
    status: "live",
    join_code: joinCode,
    current_question_index: 0,
    started_at: new Date().toISOString(),
    settings_json: { question_ids: questionIds, host_token: hostToken, allow_late_join: true },
  })
  .select("*")
  .single();

const snapshotV1 = {
  settings: settingsV1,
  time_per_q: 30,
  mode: "jeopardy",
  question_ids: questionIds,
  pool_id: pool.id,
  name: template.name,
};
const { data: instance } = await admin
  .from("game_instances")
  .insert({
    template_id: template.id,
    template_version: 1,
    host_id: userId,
    quiz_session_id: session.id,
    join_code: joinCode,
    host_token: hostToken,
    status: "live",
    started_at: new Date().toISOString(),
    settings_snapshot: snapshotV1,
  })
  .select("*")
  .single();
pass("launch instance snapshot v1", instance.template_version === 1 && instance.settings_snapshot.time_per_q === 30, "");

const joined = await pub.rpc("join_game_by_code", {
  p_join_code: joinCode,
  p_display_name: "Casey",
  p_student_code: "AX7-9K2",
});
if (joined.error) throw new Error(joined.error.message);
const player = joined.data[0];
const { data: participant } = await admin
  .from("quiz_participants")
  .select("student_profile_id, display_name")
  .eq("id", player.participant_id)
  .single();
pass("student_profile_id populated", Boolean(participant.student_profile_id), participant.student_profile_id);

await admin.rpc("quiz_set_question", { p_session_id: session.id, p_index: 0 });
await pub.rpc("submit_answer", {
  p_participant_token: player.participant_token,
  p_question_id: qs[0].id,
  p_choice_key: "A",
  p_ms_taken: 4000,
});
await admin.rpc("quiz_apply_reveal", { p_session_id: session.id, p_question_id: qs[0].id, p_correct_key: "A" });
const { data: response } = await admin
  .from("quiz_responses")
  .select("points_earned, is_correct")
  .eq("session_id", session.id)
  .eq("question_id", qs[0].id)
  .single();
pass("points_earned written", response.points_earned > 0 && response.is_correct === true, String(response.points_earned));

await admin.rpc("quiz_end_session", { p_session_id: session.id });
await admin.rpc("finalize_game_instance", { p_session_id: session.id });
const { data: ended } = await admin.from("game_instances").select("status, participant_count, avg_score").eq("id", instance.id).single();
const { data: after } = await admin.from("game_templates").select("play_count, last_played_at, version").eq("id", template.id).single();
pass("play_count increments", after.play_count === 1 && ended.status === "ended", `plays=${after.play_count} status=${ended.status}`);

await admin.from("game_templates").update({ settings_json: { ...settingsV1, time_per_q: 20 }, version: 2 }).eq("id", template.id);
const { data: bumped } = await admin.from("game_templates").select("version, settings_json").eq("id", template.id).single();
const { data: oldSnap } = await admin.from("game_instances").select("settings_snapshot, template_version").eq("id", instance.id).single();
pass("v2 bump does not mutate old snapshot", bumped.version === 2 && oldSnap.template_version === 1 && oldSnap.settings_snapshot.time_per_q === 30, `now=${bumped.settings_json.time_per_q} snap=${oldSnap.settings_snapshot.time_per_q}`);

const { data: archived } = await admin.from("game_templates").update({ deleted_at: new Date().toISOString() }).eq("id", template.id).select("deleted_at").single();
pass("soft delete", Boolean(archived.deleted_at), "");
const { data: restored } = await admin.from("game_templates").update({ deleted_at: null }).eq("id", template.id).select("deleted_at").single();
pass("restore", restored.deleted_at == null, "");

const { data: tables } = await admin.rpc("health_public_table_count");
pass("health tables 28", tables === 28, `tables=${tables}`);

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
