import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assertPlayableMode,
  launchBlockMessage,
  resolveGameQuestions,
  validateTemplateSource,
} from "@/lib/games/resolve";

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

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users[0].id;
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: klass } = await admin
  .from("classes")
  .insert({ level_id: level.id, title: `6C.1 ${Date.now()}`, audience: "verify", created_by: userId })
  .select("id")
  .single();
const { data: standard } = await admin.from("standards").select("id, code").order("code").limit(1).maybeSingle();

function questionRow(stem, approved, extra = {}) {
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
    approved,
    rejected: false,
    tag_approved: approved,
    created_by: userId,
    standard_id: extra.standard_id ?? standard?.id ?? null,
    difficulty: extra.difficulty ?? "medium",
  };
}

async function makePool(name, questions) {
  const { data: pool, error } = await admin
    .from("question_pools")
    .insert({ class_id: klass.id, name, shuffle_on_play: false, time_per_q: 30 })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("question_pool_items").insert(questions.map((row, index) => ({ pool_id: pool.id, question_id: row.id, order: index })));
  return pool;
}

// Test 1 — pool with unapproved questions
const { data: unapproved } = await admin
  .from("questions")
  .insert(Array.from({ length: 5 }, (_, index) => questionRow(`6C.1 unapproved ${index + 1}`, false)))
  .select("id");
const pool1 = await makePool("6C.1 unapproved pool", unapproved);
const template1 = { class_id: klass.id, pool_id: pool1.id, filter_json: {}, mode: "jeopardy" };
const r1 = await resolveGameQuestions(template1, { supabase: admin, requireApproved: true });
pass(
  "T1 resolve unapproved pool",
  r1.questions.length === 0 && r1.diagnostics.emptyPool === false && r1.diagnostics.approvedCount === 0 && r1.diagnostics.poolItemCount === 5,
  `playable=${r1.questions.length} pool=${r1.diagnostics.poolItemCount} approved=${r1.diagnostics.approvedCount}`,
);
const block1 = launchBlockMessage(r1);
pass("T1 launch blocked message", block1.includes("0 are approved") && block1.includes("50") === false, block1);

let saveBlocked = false;
try {
  await validateTemplateSource(admin, template1);
} catch (error) {
  saveBlocked = error.message.includes("0 playable questions");
}
pass("T1 save blocked", saveBlocked, "");

await admin.from("questions").update({ approved: true }).in("id", unapproved.map((row) => row.id));
const r1b = await resolveGameQuestions(template1, { supabase: admin, requireApproved: true });
pass("T1 resolve after approve", r1b.questions.length === 5, `playable=${r1b.questions.length}`);
const { error: launch1Error } = await admin.from("game_templates").insert({
  class_id: klass.id,
  owner_id: userId,
  name: "6C.1 T1",
  mode: "jeopardy",
  pool_id: pool1.id,
  settings_json: { time_per_q: 30 },
});
pass("T1 launch save template", !launch1Error, launch1Error?.message ?? "ok");

// Test 2 — filter with 0 matches
const emptyFilter = {
  class_id: klass.id,
  pool_id: null,
  filter_json: {
    standards: ["00000000-0000-0000-0000-000000000001"],
    concepts: [],
    difficulty: ["hard"],
    sources: [],
    approved_only: true,
  },
  mode: "jeopardy",
};
const r2 = await resolveGameQuestions(emptyFilter, { supabase: admin, requireApproved: true });
pass(
  "T2 filter zero matches",
  r2.questions.length === 0 && r2.diagnostics.noMatchingQuestions === true,
  `matches=${r2.diagnostics.filterMatchCount}`,
);
let save2 = false;
try {
  await validateTemplateSource(admin, emptyFilter);
} catch (error) {
  save2 = error.message.includes("0 playable questions");
}
pass("T2 save blocked", save2, "");

// Test 3 — filter with matches
const { data: tagged } = await admin
  .from("questions")
  .insert(Array.from({ length: 4 }, (_, index) => questionRow(`6C.1 filter ${index + 1}`, true, { standard_id: standard.id, difficulty: "easy" })))
  .select("id");
const matchFilter = {
  class_id: klass.id,
  pool_id: null,
  filter_json: {
    standards: [standard.id],
    concepts: [],
    difficulty: [],
    sources: [],
    approved_only: true,
  },
  mode: "jeopardy",
};
const r3 = await resolveGameQuestions(matchFilter, { supabase: admin, requireApproved: true });
pass("T3 filter matches", r3.questions.length >= 4, `n=${r3.questions.length}`);
const saved3 = await validateTemplateSource(admin, matchFilter);
pass("T3 save succeeds", saved3.questions.length >= 4, "");
const { data: t3row, error: t3error } = await admin
  .from("game_templates")
  .insert({
    class_id: klass.id,
    owner_id: userId,
    name: "6C.1 filter",
    mode: "jeopardy",
    pool_id: null,
    filter_json: matchFilter.filter_json,
    settings_json: { time_per_q: 45 },
  })
  .select("*")
  .single();
pass("T3 persist template", !t3error && t3row, t3error?.message ?? t3row?.id);
const snapshotIds = r3.questionIds;
pass("T3 snapshot has N ids", snapshotIds.length === r3.questions.length && snapshotIds.length >= 4, String(snapshotIds.length));

// Test 4 — overview vs launch consistency
const { data: mixApproved } = await admin
  .from("questions")
  .insert(Array.from({ length: 10 }, (_, index) => questionRow(`6C.1 mix A ${index + 1}`, true)))
  .select("id");
const { data: mixPending } = await admin
  .from("questions")
  .insert(Array.from({ length: 5 }, (_, index) => questionRow(`6C.1 mix P ${index + 1}`, false)))
  .select("id");
const pool4 = await makePool("6C.1 mix", [...mixApproved, ...mixPending]);
const template4 = { class_id: klass.id, pool_id: pool4.id, filter_json: {}, mode: "jeopardy" };
const overview = await resolveGameQuestions(template4, { supabase: admin, requireApproved: true });
const launch = await resolveGameQuestions(template4, { supabase: admin, requireApproved: true });
const diagnose = await resolveGameQuestions(template4, { supabase: admin, requireApproved: false });
pass(
  "T4 overview 10 playable",
  overview.questions.length === 10,
  String(overview.questions.length),
);
pass(
  "T4 launch loads 10",
  launch.questions.length === 10 && launch.questionIds.length === 10,
  String(launch.questionIds.length),
);
pass(
  "T4 diagnose 15 total / 10 approved",
  diagnose.diagnostics.poolItemCount === 15 && diagnose.diagnostics.approvedCount === 10 && overview.questions.length === 10,
  `total=${diagnose.diagnostics.poolItemCount} approved=${diagnose.diagnostics.approvedCount}`,
);
pass("T4 overview === launch", overview.questionIds.join() === launch.questionIds.join(), "");

// Test 5 — mode gating
const wizardSource = readFileSync(join(process.cwd(), "components/games/GameWizard.tsx"), "utf8");
pass(
  "T5 coming soon still gated",
  wizardSource.includes("pointer-events-none") && wizardSource.includes("Coming soon"),
  "",
);
pass("T5 rapid_fire playable in wizard", wizardSource.includes("Rapid Fire") && !wizardSource.includes("Coming in 6D"), "");
let rapidBlocked = false;
try {
  assertPlayableMode("rapid_fire");
} catch {
  rapidBlocked = true;
}
pass("T5 rapid_fire save allowed", !rapidBlocked, "");
let teamBlocked = false;
try {
  assertPlayableMode("team_battle");
} catch {
  teamBlocked = true;
}
pass("T5 team_battle save allowed", !teamBlocked, "");
let caseBlocked = false;
try {
  assertPlayableMode("case_study");
} catch {
  caseBlocked = true;
}
pass("T5 case_study still blocked", caseBlocked, "");

const unused = tagged;
void unused;

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
