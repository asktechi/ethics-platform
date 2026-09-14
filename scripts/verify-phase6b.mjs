import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { isTrustedHostEvent } from "@/lib/quiz/realtime.ts";
import { scoreQuestion, sortLeaderboard } from "@/lib/quiz/scoring.ts";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !service || !anon) {
  console.error("Missing Supabase env.");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

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

async function applySessionBMigration() {
  if (!process.env.SUPABASE_DB_URL) {
    pass("apply session B migration", false, "SUPABASE_DB_URL missing");
    return false;
  }
  const client = new pg.Client({
    connectionString: poolerUrl(process.env.SUPABASE_DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const existing = await client.query("select 1 from pg_proc where proname = 'quiz_skip_question' limit 1");
    if (existing.rowCount) {
      await client.query("drop function if exists public.join_quiz(text, text)");
      pass("apply session B migration", true, "already applied");
      return true;
    }
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260913230000_quiz_session_b.sql"), "utf8");
    await client.query(sql);
    await client.query("drop function if exists public.join_quiz(text, text)");
    pass("apply session B migration", true, "ok");
    return true;
  } catch (error) {
    pass("apply session B migration", false, error.message);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const alice5s = scoreQuestion(5000, 30, 0, true);
pass(
  "scoring Alice 5.0s correct",
  alice5s.points === 100 + alice5s.timeBonus && alice5s.timeBonus === Math.round(100 * (1 - 5000 / 30000)),
  JSON.stringify(alice5s),
);
pass("scoring Bob wrong", scoreQuestion(12000, 30, 0, false).points === 0, "");
pass(
  "scoring streak bonus",
  scoreQuestion(0, 30, 2, true).points === 100 + 100 + 40,
  String(scoreQuestion(0, 30, 2, true).points),
);

const tied = sortLeaderboard([
  { score: 200, last_correct_at: "2026-09-13T10:00:05.000Z", name: "slow" },
  { score: 200, last_correct_at: "2026-09-13T10:00:01.000Z", name: "fast" },
  { score: 180, last_correct_at: "2026-09-13T10:00:00.000Z", name: "third" },
]);
pass(
  "leaderboard tie-break last_correct_at ASC",
  tied[0].name === "fast" && tied[1].name === "slow" && tied[2].name === "third",
  tied.map((row) => row.name).join(","),
);

const hostId = "host-1";
const hostToken = "token-1";
pass(
  "host-only: missing sender rejected",
  isTrustedHostEvent({ type: "END" }, hostId, hostToken) === false,
  "",
);
pass(
  "host-only: wrong sender rejected",
  isTrustedHostEvent({ type: "END", sender: "other", host_token: hostToken }, hostId, hostToken) === false,
  "",
);
pass(
  "host-only: wrong token rejected",
  isTrustedHostEvent({ type: "END", sender: hostId, host_token: "nope" }, hostId, hostToken) === false,
  "",
);
pass(
  "host-only: matching host accepted",
  isTrustedHostEvent({ type: "END", sender: hostId, host_token: hostToken }, hostId, hostToken) === true,
  "",
);

await applySessionBMigration();

const { data: users } = await admin.from("users").select("id,email,name").limit(5);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No instructor user");

const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({
    level_id: level.id,
    title: `Phase 6B quiz ${Date.now()}`,
    audience: "Internal verify",
    created_by: userId,
  })
  .select("id")
  .single();
if (classError) throw new Error(classError.message);

const extras = [];
for (let index = 0; index < 10; index += 1) {
  extras.push({
    class_id: klass.id,
    stem: `Phase 6B Q${index + 1}: which choice is correct?`,
    choices_json: [
      { key: "A", text: "Alpha" },
      { key: "B", text: "Bravo" },
      { key: "C", text: "Charlie" },
      { key: "D", text: "Delta" },
    ],
    answer_key: ["A", "B", "C", "D", "A", "B", "C", "D", "A", "B"][index],
    explanation: "Verify key.",
    source: "mine",
    approved: true,
    rejected: false,
    tag_approved: true,
    created_by: userId,
  });
}
const inserted = await admin.from("questions").insert(extras).select("id, stem, choices_json, answer_key, explanation");
if (inserted.error) throw new Error(inserted.error.message);
const ten = inserted.data ?? [];

const { data: pool, error: poolError } = await admin
  .from("question_pools")
  .insert({ class_id: klass.id, name: "Phase 6B Ten", shuffle_on_play: false, time_per_q: 30 })
  .select("*")
  .single();
if (poolError) throw new Error(poolError.message);
const items = ten.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index }));
const itemInsert = await admin.from("question_pool_items").insert(items);
if (itemInsert.error) throw new Error(itemInsert.error.message);

const joinCode = `B6${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6);
const hostTokenValue = crypto.randomUUID();
const questionIds = ten.map((row) => row.id);
const { data: session, error: sessionError } = await admin
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
    reveal_answer: false,
    settings_json: {
      allow_late_join: true,
      show_leaderboard: true,
      show_correct_answer: true,
      shuffle: false,
      question_ids: questionIds,
      host_token: hostTokenValue,
    },
  })
  .select("*")
  .single();
if (sessionError) throw new Error(sessionError.message);
pass("launch session with host_token", Boolean(session.id && hostTokenValue), session.join_code);

const joinResults = await Promise.all(
  Array.from({ length: 50 }, (_, index) =>
    publicClient.rpc("join_quiz", {
      p_join_code: joinCode,
      p_display_name: index === 0 ? "Alice" : index === 1 ? "Bob" : `P${index + 1}`,
    }),
  ),
);
const players = joinResults.map((row, index) => {
  if (row.error) return { error: row.error.message, index };
  return row.data?.[0];
});
const joinedOk = players.filter((row) => row?.participant_token);
pass(
  "50 participants join",
  joinedOk.length === 50,
  `ok=${joinedOk.length} firstHost=${joinedOk[0]?.host_id ?? ""} token=${Boolean(joinedOk[0]?.host_token)}`,
);
pass(
  "join_quiz returns host credentials",
  Boolean(joinedOk[0]?.host_id && joinedOk[0]?.host_token === hostTokenValue),
  `host_id=${joinedOk[0]?.host_id ?? "none"} tokenMatch=${joinedOk[0]?.host_token === hostTokenValue}`,
);

const expected = new Map(joinedOk.map((player) => [player.participant_id, { score: 0, streak: 0 }]));

for (let q = 0; q < 10; q += 1) {
  const setQ = await admin.rpc("quiz_set_question", { p_session_id: session.id, p_index: q });
  if (setQ.error) throw new Error(`set question ${q}: ${setQ.error.message}`);
  const answerKey = ten[q].answer_key;
  const submits = await Promise.all(
    joinedOk.map((player, index) => {
      const correct = (index + q) % 3 !== 0;
      const ms = 1000 + ((index * 17 + q * 31) % 20000);
      const choice = correct ? answerKey : answerKey === "A" ? "B" : "A";
      const prior = expected.get(player.participant_id);
      const scored = scoreQuestion(ms, 30, prior.streak, correct);
      expected.set(player.participant_id, {
        score: prior.score + scored.points,
        streak: scored.nextStreak,
      });
      return publicClient.rpc("submit_answer", {
        p_participant_token: player.participant_token,
        p_question_id: ten[q].id,
        p_choice_key: choice,
        p_ms_taken: ms,
      });
    }),
  );
  const submitOk = submits.filter((row) => !row.error && row.data?.[0]?.ok).length;
  const reveal = await admin.rpc("quiz_apply_reveal", {
    p_session_id: session.id,
    p_question_id: ten[q].id,
    p_correct_key: answerKey,
  });
  if (reveal.error) throw new Error(`reveal ${q}: ${reveal.error.message}`);
  if (q === 0) {
    pass("Q1 parallel submit", submitOk === 50, `ok=${submitOk}`);
  }
}

const { count: participantCount } = await admin
  .from("quiz_participants")
  .select("id", { count: "exact", head: true })
  .eq("session_id", session.id)
  .is("deleted_at", null);

const { count: responseCount } = await admin
  .from("quiz_responses")
  .select("id", { count: "exact", head: true })
  .eq("session_id", session.id)
  .is("deleted_at", null);

pass(
  "50 participants, 500 responses",
  (participantCount ?? 0) === 50 && (responseCount ?? 0) === 500,
  `participants=${participantCount} responses=${responseCount}`,
);

const { data: scoredRows } = await admin
  .from("quiz_participants")
  .select("id, display_name, score, streak, last_correct_at")
  .eq("session_id", session.id)
  .is("deleted_at", null);

let scoreMismatches = 0;
for (const row of scoredRows ?? []) {
  const want = expected.get(row.id);
  if (!want || want.score !== row.score || want.streak !== row.streak) scoreMismatches += 1;
}
pass("Jeopardy totals match formula", scoreMismatches === 0, `mismatches=${scoreMismatches}`);

const sorted = sortLeaderboard(scoredRows ?? []);
const dbOrder = [...(scoredRows ?? [])].sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  const aTime = a.last_correct_at ? new Date(a.last_correct_at).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.last_correct_at ? new Date(b.last_correct_at).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
});
pass(
  "leaderboard sorted score DESC then last_correct_at ASC",
  sorted.every((row, index) => row.id === dbOrder[index]?.id),
  `top=${sorted[0]?.display_name}:${sorted[0]?.score}`,
);

const pause = await admin.rpc("quiz_set_pause", {
  p_session_id: session.id,
  p_paused: true,
  p_remaining_ms: 12000,
});
pass("quiz_set_pause", !pause.error, pause.error?.message ?? "ok");

const skip = await admin.rpc("quiz_skip_question", { p_session_id: session.id });
pass("quiz_skip_question", !skip.error, skip.error?.message ?? "ok");

await admin.rpc("quiz_end_session", { p_session_id: session.id });
const { data: ended } = await admin.from("quiz_sessions").select("status, ended_at").eq("id", session.id).single();
pass("end session", ended?.status === "ended" && Boolean(ended.ended_at), ended?.status);

const board = await publicClient.rpc("get_final_leaderboard", { p_session_id: session.id });
pass("final leaderboard 50 rows", (board.data?.length ?? 0) === 50, `rows=${board.data?.length ?? 0}`);

const { data: pub } = await admin.rpc("health_public_table_count");
pass("health tables", pub === 30, `tables=${pub}`);

let publication = [];
if (process.env.SUPABASE_DB_URL) {
  const client = new pg.Client({
    connectionString: poolerUrl(process.env.SUPABASE_DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `select tablename
     from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename in ('quiz_sessions', 'quiz_participants', 'quiz_responses')
     order by tablename`,
  );
  publication = rows.map((row) => row.tablename);
  await client.end();
}
pass(
  "realtime publication includes quiz_responses",
  publication.includes("quiz_responses"),
  publication.join(",") || "none",
);

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ sessionId: session.id, joinCode, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
