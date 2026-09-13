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

function channelName(sessionId) {
  return `quiz:${sessionId}`;
}

function waitSubscribed(channel, label, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} subscribe timeout`)), timeoutMs);
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve(channel);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`${label} ${status}`));
      }
    });
  });
}

function listenFor(channel, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("event timeout")), 8000);
    channel.on("broadcast", { event: "quiz" }, ({ payload }) => {
      if (predicate(payload)) {
        clearTimeout(timer);
        resolve({ payload, at: Date.now() });
      }
    });
  });
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

const { data: users } = await admin.from("users").select("id,email,name").limit(5);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No instructor user");

const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({
    level_id: level.id,
    title: `Phase 6 quiz ${Date.now()}`,
    audience: "Internal verify",
    created_by: userId,
  })
  .select("id")
  .single();
if (classError) throw new Error(classError.message);

const { data: existing } = await admin
  .from("questions")
  .select("id, stem, choices_json, answer_key, explanation")
  .eq("approved", true)
  .is("deleted_at", null)
  .limit(8);
let questionRows = existing ?? [];
if (questionRows.length < 5) {
  const extras = [];
  for (let index = questionRows.length; index < 5; index += 1) {
    extras.push({
      class_id: klass.id,
      stem: `Phase 6 verify question ${index + 1}: which choice is correct?`,
      choices_json: [
        { key: "A", text: "Alpha" },
        { key: "B", text: "Bravo" },
        { key: "C", text: "Charlie" },
        { key: "D", text: "Delta" },
      ],
      answer_key: "B",
      explanation: "B is the verify key.",
      source: "mine",
      approved: true,
      rejected: false,
      tag_approved: true,
      created_by: userId,
    });
  }
  const inserted = await admin.from("questions").insert(extras).select("id, stem, choices_json, answer_key, explanation");
  if (inserted.error) throw new Error(inserted.error.message);
  questionRows = [...questionRows, ...(inserted.data ?? [])];
}
const five = questionRows.slice(0, 5);

const { data: pool, error: poolError } = await admin
  .from("question_pools")
  .insert({ class_id: klass.id, name: "Phase 6 Live Five", shuffle_on_play: false, time_per_q: 30 })
  .select("*")
  .single();
if (poolError) throw new Error(poolError.message);
const items = five.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index }));
const itemInsert = await admin.from("question_pool_items").insert(items);
if (itemInsert.error) throw new Error(itemInsert.error.message);

const joinCode = `P6${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6);
const questionIds = five.map((row) => row.id);
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
    },
  })
  .select("*")
  .single();
if (sessionError) throw new Error(sessionError.message);
pass("1 launch session", Boolean(session.id) && session.status === "live" && session.join_code.length === 6, session.join_code);

const lookup = await publicClient.rpc("lookup_quiz_by_code", { p_code: joinCode });
if (lookup.error) throw new Error(lookup.error.message);
pass("3 lookup waiting room meta", Boolean(lookup.data?.[0]?.session_id), lookup.data?.[0]?.pool_name);

const joined = await publicClient.rpc("join_quiz", {
  p_join_code: joinCode,
  p_display_name: "Test Student",
});
if (joined.error) throw new Error(joined.error.message);
const student = joined.data?.[0];
pass("2 join Test Student", Boolean(student?.participant_token && student.avatar_color), student?.participant_id);

const set0 = await admin.rpc("quiz_set_question", { p_session_id: session.id, p_index: 0 });
if (set0.error) throw new Error(set0.error.message);

const tooSoon = await publicClient.rpc("submit_answer", {
  p_participant_token: student.participant_token,
  p_question_id: five[1].id,
  p_choice_key: "A",
  p_ms_taken: 100,
});
pass("submit wrong question rejected", Boolean(tooSoon.error), tooSoon.error?.message ?? "no error");

const aliceClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const bobClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const aliceChannel = aliceClient.channel(channelName(session.id), { config: { broadcast: { self: true } } });
const bobChannel = bobClient.channel(channelName(session.id), { config: { broadcast: { self: true } } });
const hostChannel = admin.channel(channelName(session.id), { config: { broadcast: { ack: true } } });

const aliceQ0 = listenFor(aliceChannel, (payload) => payload?.type === "QUESTION" && payload.questionIndex === 0);
const bobQ0 = listenFor(bobChannel, (payload) => payload?.type === "QUESTION" && payload.questionIndex === 0);

await Promise.all([
  waitSubscribed(aliceChannel, "alice"),
  waitSubscribed(bobChannel, "bob"),
  waitSubscribed(hostChannel, "host"),
]);

const questionPayload = {
  type: "QUESTION",
  questionIndex: 0,
  question_id: five[0].id,
  stem: five[0].stem,
  choices: five[0].choices_json,
  time_limit_seconds: 30,
  started_at: new Date().toISOString(),
};
const publishedAt = Date.now();
await hostChannel.send({ type: "broadcast", event: "quiz", payload: questionPayload });

let aliceMs = null;
let bobMs = null;
try {
  await aliceQ0;
  aliceMs = Date.now() - publishedAt;
  pass("4/5 QUESTION 0 to player", aliceMs < 300, `${aliceMs}ms`);
} catch (error) {
  pass("4/5 QUESTION 0 to player", false, error.message);
}
try {
  await bobQ0;
  bobMs = Date.now() - publishedAt;
  pass("12 both receive QUESTION", aliceMs != null && bobMs != null && Math.abs(aliceMs - bobMs) < 300, `alice=${aliceMs}ms bob=${bobMs}ms`);
} catch (error) {
  pass("12 both receive QUESTION", false, error.message);
}

const submit = await publicClient.rpc("submit_answer", {
  p_participant_token: student.participant_token,
  p_question_id: five[0].id,
  p_choice_key: five[0].answer_key || "B",
  p_ms_taken: 1200,
});
if (submit.error) throw new Error(submit.error.message);
pass("6 submit_answer", submit.data?.[0]?.ok === true && submit.data?.[0]?.already_answered === false, JSON.stringify(submit.data?.[0]));

const again = await publicClient.rpc("submit_answer", {
  p_participant_token: student.participant_token,
  p_question_id: five[0].id,
  p_choice_key: "A",
  p_ms_taken: 10,
});
pass("6 idempotent submit", again.data?.[0]?.already_answered === true, JSON.stringify(again.data?.[0]));

const me = await publicClient.rpc("get_participant_by_token", { p_token: student.participant_token });
pass("token auth lookup", me.data?.[0]?.id === student.participant_id, me.data?.[0]?.display_name);

const aliceReveal = listenFor(aliceChannel, (payload) => payload?.type === "REVEAL");
const revealAt = Date.now();
await admin.rpc("quiz_apply_reveal", {
  p_session_id: session.id,
  p_question_id: five[0].id,
  p_correct_key: five[0].answer_key || "B",
});
await hostChannel.send({
  type: "broadcast",
  event: "quiz",
  payload: {
    type: "REVEAL",
    question_id: five[0].id,
    correct_key: five[0].answer_key || "B",
    explanation: five[0].explanation || "",
  },
});
let revealMs = null;
try {
  await aliceReveal;
  revealMs = Date.now() - revealAt;
  pass("8 REVEAL realtime", revealMs < 300, `${revealMs}ms`);
} catch (error) {
  pass("8 REVEAL realtime", false, error.message);
}

const scored = await admin.from("quiz_participants").select("score, streak").eq("id", student.participant_id).single();
pass("8 score after reveal", scored.data?.score === 100 && scored.data?.streak === 1, `score=${scored.data?.score} streak=${scored.data?.streak}`);

await admin.rpc("quiz_set_question", { p_session_id: session.id, p_index: 1 });
const { data: advanced } = await admin.from("quiz_sessions").select("current_question_index").eq("id", session.id).single();
pass("9 advance to question 1", advanced.current_question_index === 1, String(advanced.current_question_index));

const aliceJoin = await publicClient.rpc("join_quiz", { p_join_code: joinCode, p_display_name: "Alice" });
const bobJoin = await publicClient.rpc("join_quiz", { p_join_code: joinCode, p_display_name: "Bob" });
pass("11 Alice+Bob join", Boolean(aliceJoin.data?.[0] && bobJoin.data?.[0]), "");

const aliceQ1 = listenFor(aliceChannel, (payload) => payload?.type === "QUESTION" && payload.questionIndex === 1);
const bobQ1 = listenFor(bobChannel, (payload) => payload?.type === "QUESTION" && payload.questionIndex === 1);
await hostChannel.send({
  type: "broadcast",
  event: "quiz",
  payload: {
    type: "QUESTION",
    questionIndex: 1,
    question_id: five[1].id,
    stem: five[1].stem,
    choices: five[1].choices_json,
    time_limit_seconds: 30,
    started_at: new Date().toISOString(),
  },
});
try {
  await Promise.all([aliceQ1, bobQ1]);
  pass("9/12 QUESTION 1 simultaneous", true, "alice+bob");
} catch (error) {
  pass("9/12 QUESTION 1 simultaneous", false, error.message);
}

const aliceSubmit = await publicClient.rpc("submit_answer", {
  p_participant_token: aliceJoin.data[0].participant_token,
  p_question_id: five[1].id,
  p_choice_key: "A",
  p_ms_taken: 400,
});
const bobSubmit = await publicClient.rpc("submit_answer", {
  p_participant_token: bobJoin.data[0].participant_token,
  p_question_id: five[1].id,
  p_choice_key: five[1].answer_key || "B",
  p_ms_taken: 500,
});
await admin.rpc("quiz_apply_reveal", {
  p_session_id: session.id,
  p_question_id: five[1].id,
  p_correct_key: five[1].answer_key || "B",
});
const aliceRow = await admin.from("quiz_participants").select("score").eq("id", aliceJoin.data[0].participant_id).single();
const bobRow = await admin.from("quiz_participants").select("score").eq("id", bobJoin.data[0].participant_id).single();
pass(
  "13 Alice+Bob individual results",
  aliceSubmit.data?.[0]?.ok && bobSubmit.data?.[0]?.ok && aliceRow.data?.score === 0 && bobRow.data?.score === 100,
  `alice=${aliceRow.data?.score} bob=${bobRow.data?.score}`,
);

const crowd = [];
for (let index = 0; index < 47; index += 1) {
  const row = await publicClient.rpc("join_quiz", {
    p_join_code: joinCode,
    p_display_name: `Load ${index + 1}`,
  });
  if (row.error) crowd.push({ error: row.error.message });
  else crowd.push(row.data?.[0]);
}

const { count: participantCount } = await admin
  .from("quiz_participants")
  .select("id", { count: "exact", head: true })
  .eq("session_id", session.id)
  .is("deleted_at", null);

const { data: allPlayers } = await admin
  .from("quiz_participants")
  .select("id, participant_token")
  .eq("session_id", session.id)
  .is("deleted_at", null);

await admin.rpc("quiz_set_question", { p_session_id: session.id, p_index: 0 });
await admin.from("quiz_sessions").update({ reveal_answer: false, current_question_index: 0 }).eq("id", session.id);

let submitted = 0;
for (const member of allPlayers ?? []) {
  const result = await publicClient.rpc("submit_answer", {
    p_participant_token: member.participant_token,
    p_question_id: five[0].id,
    p_choice_key: "A",
    p_ms_taken: 200,
  });
  if (!result.error) submitted += 1;
}

const { count: responseCount } = await admin
  .from("quiz_responses")
  .select("id", { count: "exact", head: true })
  .eq("session_id", session.id)
  .eq("question_id", five[0].id)
  .is("deleted_at", null);

const { data: sameIndex } = await admin.from("quiz_sessions").select("current_question_index").eq("id", session.id).single();
pass(
  "14-15 50-player join+submit",
  (participantCount ?? 0) === 50 && (responseCount ?? 0) === 50 && submitted === 50,
  `participants=${participantCount} q0 responses=${responseCount} submits=${submitted} crowdOk=${crowd.filter((item) => item?.participant_token).length}`,
);
pass("16 same questionIndex", sameIndex?.current_question_index === 0, String(sameIndex?.current_question_index));

const overflow = await publicClient.rpc("join_quiz", { p_join_code: joinCode, p_display_name: "Overflow" });
pass("50 cap", Boolean(overflow.error), overflow.error?.message ?? "allowed 51st");

await admin.rpc("quiz_end_session", { p_session_id: session.id });
const board = await publicClient.rpc("get_final_leaderboard", { p_session_id: session.id });
pass("10 END leaderboard", (board.data?.length ?? 0) === 50, `rows=${board.data?.length ?? 0}`);

const latencies = [aliceMs, bobMs, revealMs].filter((value) => typeof value === "number");
const maxLatency = latencies.length ? Math.max(...latencies) : null;
pass("7 realtime latency under 300ms", latencies.length === 3 && (maxLatency ?? 9999) < 300, `max=${maxLatency}ms values=${latencies.join(",")}`);

const { data: pub } = await admin.rpc("health_public_table_count");
pass("health tables", pub === 22, `tables=${pub}`);

let publication = [];
if (process.env.SUPABASE_DB_URL) {
  const client = new pg.Client({
    connectionString: poolerUrl(process.env.SUPABASE_DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `select schemaname, tablename
     from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename in ('quiz_sessions', 'quiz_participants')
     order by tablename`,
  );
  publication = rows;
  await client.end();
}
pass(
  "realtime publication",
  publication.length === 2,
  publication.map((row) => row.tablename).join(",") || "not in supabase_realtime — enable at /database/replication",
);

console.log(JSON.stringify({ sessionId: session.id, joinCode, results, maxLatency, publication }, null, 2));
if (results.some((item) => !item.ok)) process.exit(1);
