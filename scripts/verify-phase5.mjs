import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Papa from "papaparse";

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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!url || !key) {
  console.error("Missing Supabase admin env.");
  process.exit(1);
}
if (!openaiKey) {
  console.error("Missing OPENAI_API_KEY.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const openai = new OpenAI({ apiKey: openaiKey });

const RATES = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
};

function estimateCost(model, inputTokens, outputTokens) {
  const rate = RATES[model] ?? RATES["gpt-4o-mini"];
  return Number((inputTokens * rate.input + outputTokens * rate.output).toFixed(6));
}

async function logUsage({ userId, classId, feature, model, inputTokens, outputTokens }) {
  const cost = estimateCost(model, inputTokens, outputTokens);
  const { error } = await admin.from("ai_usage_log").insert({
    user_id: userId,
    class_id: classId,
    feature,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: cost,
  });
  if (error) throw new Error(error.message);
  return cost;
}

function parseCsv(buffer) {
  const parsed = Papa.parse(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
  return parsed.data.map((row) => ({
    stem: String(row.stem ?? "").trim(),
    choices: ["a", "b", "c", "d"]
      .map((letter, index) => ({
        key: String.fromCharCode(65 + index),
        text: String(row[`choice_${letter}`] ?? "").trim(),
      }))
      .filter((choice) => choice.text),
    answer_key: String(row.answer ?? "").trim().toUpperCase(),
    explanation: String(row.explanation ?? "").trim(),
  }));
}

async function tagOne(question, standards, concepts, meta) {
  const user = [
    `STEM:\n${question.stem}`,
    `CHOICES:\n${question.choices.map((choice) => `${choice.key}. ${choice.text}`).join("\n")}`,
    `ANSWER: ${question.answer_key}`,
    question.explanation ? `EXPLANATION: ${question.explanation}` : "",
    `STANDARDS:\n${standards.map((item) => `${item.id} | ${item.code} | ${item.title}`).join("\n")}`,
    `CONCEPTS:\n${concepts.map((item) => `${item.id} | ${item.title}`).join("\n") || "(none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a CFA ethics curriculum expert. Classify each question to exactly one CFA Standard and at most one Concept from the provided lists. Return JSON with keys: standard_id, concept_id, difficulty, confidence (0-1), reasoning (one sentence). Use only ids from the lists. If no concept fits, concept_id may be null. difficulty must be easy, medium, or hard.",
      },
      { role: "user", content: user },
    ],
  });
  await logUsage({
    userId: meta.userId,
    classId: meta.classId,
    feature: "tagging",
    model: "gpt-4o-mini",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });
  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  return {
    questionId: question.id,
    standard_id: resolveListId(raw.standard_id, standards),
    concept_id: resolveListId(raw.concept_id, concepts),
    difficulty:
      raw.difficulty === "easy" || raw.difficulty === "hard" || raw.difficulty === "medium"
        ? raw.difficulty
        : "medium",
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0))),
    reasoning: String(raw.reasoning ?? "").slice(0, 400),
  };
}

function resolveListId(raw, items) {
  const value = String(raw ?? "").trim();
  if (!value || value === "null" || value === "undefined") return null;
  const exactId = items.find((item) => item.id === value);
  if (exactId) return exactId.id;
  const lower = value.toLowerCase();
  const byCode = items.find((item) => (item.code ?? "").toLowerCase() === lower);
  if (byCode) return byCode.id;
  const byTitle = items.find(
    (item) => (item.title ?? "").toLowerCase() === lower || (item.name ?? "").toLowerCase() === lower,
  );
  if (byTitle) return byTitle.id;
  const matches = items.filter((item) => {
    const code = (item.code ?? "").toLowerCase();
    return Boolean(code) && (lower.includes(code) || code.includes(lower));
  });
  matches.sort((a, b) => (b.code?.length ?? 0) - (a.code?.length ?? 0));
  return matches[0]?.id ?? null;
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const csv = readFileSync(join(process.cwd(), "fixtures/samples/questions-1.csv"));
const parsed = parseCsv(csv);
if (parsed.length !== 10) {
  console.error("Fixture must have 10 questions, got", parsed.length);
  process.exit(1);
}

const { data: users } = await admin.from("users").select("id,email").limit(5);
let userId = users?.[0]?.id;
if (!userId) {
  const created = await admin.auth.admin.createUser({
    email: "phase5-verify@example.com",
    email_confirm: true,
  });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;
  await admin.from("users").upsert({
    id: userId,
    role: "instructor",
    name: "Phase 5 verify",
    email: "phase5-verify@example.com",
  });
}

const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({
    level_id: level.id,
    title: `Phase 5 question bank ${Date.now()}`,
    audience: "Internal verify",
    created_by: userId,
  })
  .select("id,title")
  .single();
if (classError) throw new Error(classError.message);
const classId = klass.id;

const { data: batch, error: batchError } = await admin
  .from("import_batches")
  .insert({
    class_id: classId,
    filename: "questions-1.csv",
    question_count: parsed.length,
    imported_by: userId,
  })
  .select("id")
  .single();
if (batchError) throw new Error(batchError.message);

const rows = parsed.map((question) => ({
  class_id: classId,
  stem: question.stem,
  choices_json: question.choices,
  answer_key: question.answer_key,
  explanation: question.explanation,
  source: "imported",
  approved: false,
  rejected: false,
  tag_approved: false,
  created_by: userId,
  import_batch_id: batch.id,
}));
const inserted = await admin.from("questions").insert(rows).select("*");
if (inserted.error) throw new Error(inserted.error.message);
const questions = inserted.data ?? [];
const untagged = questions.filter((q) => !q.approved && !q.standard_id);
pass(
  "1 import CSV",
  questions.length === 10 && untagged.length === 10,
  `${questions.length} rows, approved=false, no standard`,
);

const { data: standards } = await admin
  .from("standards")
  .select("id, code, title, body")
  .is("deleted_at", null)
  .order("order");
const { data: concepts } = await admin
  .from("concepts")
  .select("id, title, sections!inner(class_id)")
  .eq("sections.class_id", classId)
  .is("deleted_at", null);

const proposals = await mapLimit(questions, 3, (question) =>
  tagOne(
    {
      id: question.id,
      stem: question.stem,
      choices: question.choices_json,
      answer_key: question.answer_key,
      explanation: question.explanation,
    },
    standards,
    (concepts ?? []).map((item) => ({ id: item.id, title: item.title })),
    { userId, classId },
  ),
);
pass("2 auto-tag", proposals.length === 10, `${proposals.length} proposals`);

const high = proposals.filter((item) => item.confidence > 0.8);
const approveSet = high.slice(0, Math.max(high.length, 0));
for (const item of approveSet) {
  const { error } = await admin
    .from("questions")
    .update({
      standard_id: item.standard_id,
      concept_id: item.concept_id,
      difficulty: item.difficulty,
      ai_tag_confidence: item.confidence,
      ai_tag_reasoning: item.reasoning,
      tag_approved: true,
    })
    .eq("id", item.questionId);
  if (error) throw new Error(error.message);
}
pass(
  "3 approve confidence > 0.8",
  approveSet.length >= 1,
  `approved ${approveSet.length} of ${high.length} high-confidence`,
);

const leftover = proposals.find((item) => !approveSet.some((hit) => hit.questionId === item.questionId)) ?? proposals[0];
const fallbackStandard = standards.find((item) => item.code === "I(A)") ?? standards[0];
await admin
  .from("questions")
  .update({
    rejected: true,
    approved: false,
    standard_id: leftover.standard_id,
    tag_approved: false,
  })
  .eq("id", leftover.questionId);
await admin
  .from("questions")
  .update({
    standard_id: fallbackStandard.id,
    rejected: false,
    tag_approved: true,
  })
  .eq("id", leftover.questionId);
const { data: fixed } = await admin.from("questions").select("standard_id, rejected").eq("id", leftover.questionId).single();
pass("4 manual standard fix", fixed.standard_id === fallbackStandard.id && fixed.rejected === false, fallbackStandard.code);

const target = questions.find((item) => item.id !== leftover.questionId) ?? questions[0];
await admin.from("questions").update({ deleted_at: new Date().toISOString() }).eq("id", target.id);
const { data: hidden } = await admin
  .from("questions")
  .select("id")
  .eq("class_id", classId)
  .is("deleted_at", null);
const { data: archived } = await admin
  .from("questions")
  .select("id")
  .eq("class_id", classId)
  .not("deleted_at", "is", null);
await admin.from("questions").update({ deleted_at: null }).eq("id", target.id);
const { data: restored } = await admin.from("questions").select("deleted_at").eq("id", target.id).single();
pass(
  "5 soft-delete / restore",
  hidden.length === 9 && archived.length === 1 && restored.deleted_at === null,
  `hidden ${hidden.length}, archived ${archived.length}, restored`,
);

const standardII = standards.filter((item) => item.code === "II" || item.code.startsWith("II("));
const iiIds = new Set(standardII.map((item) => item.id));
const { data: afterTags } = await admin
  .from("questions")
  .select("id, stem, standard_id, ai_tag_confidence")
  .eq("class_id", classId)
  .is("deleted_at", null);
const iiRows = (afterTags ?? []).filter((row) => row.standard_id && iiIds.has(row.standard_id));
pass("6 filter Standard II", iiRows.length >= 1 && iiRows.length < (afterTags ?? []).length, `${iiRows.length} questions`);

const needle = "elevator";
const searched = (afterTags ?? []).filter((row) => row.stem.toLowerCase().includes(needle));
pass("7 search stem", searched.length === 1, `"${needle}" → ${searched.length}`);

const standardIIIC = standards.find((item) => item.code === "III(C)");
if (!standardIIIC) throw new Error("III(C) not seeded");
const sourceText = `${standardIIIC.title}\n${standardIIIC.body ?? ""}\nSuitability requires inquiry into the client's circumstances and judging the investment in the context of the whole portfolio before acting.`;
const generated = [];
for (let index = 0; index < 5; index += 1) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You write original CFA Institute ethics teaching questions. Ethics reasoning only — no investment advice, no security recommendations, no portfolio construction. Use only the Standard and source text provided. Return JSON: stem, choices (array of {key, text} with keys A-D), answer_key, explanation, reasoning. Write a direct multiple-choice ethics question.",
      },
      {
        role: "user",
        content: [
          `STANDARD: ${standardIIIC.title}`,
          standardIIIC.body ?? "",
          "CONCEPT: Suitability",
          "DIFFICULTY: medium",
          `SOURCE MATERIAL:\n${sourceText.slice(0, 6000)}`,
          `This is question ${index + 1} of a set. Do not repeat earlier stems.`,
        ].join("\n\n"),
      },
    ],
  });
  await logUsage({
    userId,
    classId,
    feature: "generation",
    model: "gpt-4o",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });
  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  generated.push({
    class_id: classId,
    stem: String(raw.stem ?? "").trim(),
    choices_json: Array.isArray(raw.choices)
      ? raw.choices.map((choice, optionIndex) => ({
          key: String(choice.key ?? String.fromCharCode(65 + optionIndex)).toUpperCase().slice(0, 1),
          text: String(choice.text ?? "").trim(),
        }))
      : [],
    answer_key: String(raw.answer_key ?? "A").trim().toUpperCase().slice(0, 1),
    explanation: String(raw.explanation ?? "").trim(),
    standard_id: standardIIIC.id,
    difficulty: "medium",
    source: "ai_generated",
    approved: false,
    rejected: false,
    tag_approved: false,
    ai_tag_reasoning: String(raw.reasoning ?? "").trim(),
    created_by: userId,
  });
}
const genInsert = await admin.from("questions").insert(generated).select("*");
if (genInsert.error) throw new Error(genInsert.error.message);
pass("8 generate III(C) MCQ", (genInsert.data ?? []).length === 5, `${(genInsert.data ?? []).length} drafts`);

const toApprove = (genInsert.data ?? []).slice(0, 3);
await admin
  .from("questions")
  .update({ approved: true, rejected: false })
  .in(
    "id",
    toApprove.map((item) => item.id),
  );
const { data: approvedGen } = await admin
  .from("questions")
  .select("id, source, approved")
  .in(
    "id",
    toApprove.map((item) => item.id),
  );
pass(
  "9 approve generated",
  approvedGen.length === 3 && approvedGen.every((item) => item.source === "ai_generated" && item.approved),
  "3 approved ai_generated",
);

const { data: pool, error: poolError } = await admin
  .from("question_pools")
  .insert({ class_id: classId, name: "Level 1 Mock Quiz", shuffle_on_play: true, time_per_q: 45 })
  .select("*")
  .single();
if (poolError) throw new Error(poolError.message);
const { data: bank } = await admin
  .from("questions")
  .select("id")
  .eq("class_id", classId)
  .is("deleted_at", null)
  .limit(8);
const poolItems = (bank ?? []).map((item, index) => ({
  pool_id: pool.id,
  question_id: item.id,
  order: index,
}));
const itemsInsert = await admin.from("question_pool_items").insert(poolItems);
if (itemsInsert.error) throw new Error(itemsInsert.error.message);
const reversed = [...poolItems].reverse().map((item) => item.question_id);
for (const [index, questionId] of reversed.entries()) {
  await admin
    .from("question_pool_items")
    .update({ order: index })
    .eq("pool_id", pool.id)
    .eq("question_id", questionId);
}
const { data: ordered } = await admin
  .from("question_pool_items")
  .select("question_id, order")
  .eq("pool_id", pool.id)
  .is("deleted_at", null)
  .order("order");
pass(
  "10 create pool + reorder",
  pool.name === "Level 1 Mock Quiz" && ordered.length === 8 && ordered[0].question_id === reversed[0],
  `${ordered.length} items, first=${ordered[0].question_id.slice(0, 8)}`,
);

const { data: poolContents } = await admin
  .from("question_pool_items")
  .select("question_id, order, question:questions(id, stem, approved)")
  .eq("pool_id", pool.id)
  .is("deleted_at", null);
const preview = shuffle(poolContents ?? []);
const { data: rpcRows, error: rpcError } = await admin.rpc("load_pool_questions", { p_pool_id: pool.id });
if (rpcError) throw new Error(rpcError.message);
pass(
  "11 preview shuffle + RPC",
  preview.length === 8 && Boolean(preview[1]) && !rpcError,
  `preview ${preview.length}, dry-run next=${Boolean(preview[1])}, RPC approved-only ${rpcRows?.length ?? 0}`,
);

const { data: usage } = await admin.from("ai_usage_log").select("feature, model, cost_usd").eq("class_id", classId);
const spend = (usage ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
const taggingCalls = (usage ?? []).filter((row) => row.feature === "tagging").length;
const generationCalls = (usage ?? []).filter((row) => row.feature === "generation").length;
pass("cost log", taggingCalls >= 10 && generationCalls === 5 && spend < 0.5, `$${spend.toFixed(4)} tag=${taggingCalls} gen=${generationCalls}`);

const health = await fetch("http://127.0.0.1:43127/api/health/db").catch(() => null);
let tables = null;
if (health?.ok) {
  const body = await health.json();
  tables = body.tables;
  pass("health", body.ok === true && body.tables === 22, JSON.stringify(body));
} else {
  const { data: count, error } = await admin.rpc("health_public_table_count");
  tables = count;
  pass("health", !error && count === 22, `rpc tables=${count}`);
}

const taggedSamples = proposals.slice(0, 3).map((item) => {
  const question = questions.find((row) => row.id === item.questionId);
  const standard = standards.find((row) => row.id === item.standard_id);
  return {
    stem: question?.stem?.slice(0, 120),
    standard: standard?.code ?? null,
    confidence: item.confidence,
  };
});
const generatedSamples = (genInsert.data ?? []).slice(0, 2).map((item) => ({
  stem: item.stem,
  choices: item.choices_json,
  answer: item.answer_key,
}));

console.log(JSON.stringify({
  classId,
  spend,
  tables,
  results,
  taggedSamples,
  generatedSamples,
}, null, 2));

if (results.some((item) => !item.ok)) process.exit(1);
