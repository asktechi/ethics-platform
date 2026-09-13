import "server-only";
import OpenAI from "openai";
import { getOpenAiKey, logAiUsage } from "@/lib/ai/usage";
import { createAdminClient } from "@/lib/supabase/admin";

export type TagContextItem = { id: string; code?: string; title: string; name?: string };

export type TagProposal = {
  questionId?: string;
  standard_id: string | null;
  concept_id: string | null;
  difficulty: "easy" | "medium" | "hard";
  confidence: number;
  reasoning: string;
};

const MODEL = "gpt-4o-mini";
const SYSTEM = `You are a CFA ethics curriculum expert. Classify each question to exactly one CFA Standard and at most one Concept from the provided lists. Return JSON with keys: standard_id, concept_id, difficulty, confidence (0-1), reasoning (one sentence). Use only ids from the lists. If no concept fits, concept_id may be null. difficulty must be easy, medium, or hard.`;

function client() {
  return new OpenAI({ apiKey: getOpenAiKey() });
}

export async function tagQuestion(
  stem: string,
  choices: Array<{ key: string; text: string }>,
  answerKey: string,
  explanation: string | undefined,
  context: { standards: TagContextItem[]; concepts: TagContextItem[] },
  meta?: { userId: string; classId?: string },
): Promise<TagProposal> {
  const user = [
    `STEM:\n${stem}`,
    choices.length
      ? `CHOICES:\n${choices.map((choice) => `${choice.key}. ${choice.text}`).join("\n")}`
      : "",
    answerKey ? `ANSWER: ${answerKey}` : "",
    explanation ? `EXPLANATION: ${explanation}` : "",
    `STANDARDS:\n${context.standards.map((item) => `${item.id} | ${item.code ?? ""} | ${item.title}`).join("\n")}`,
    `CONCEPTS:\n${context.concepts.map((item) => `${item.id} | ${item.name ?? item.title}`).join("\n") || "(none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  if (meta?.userId) {
    await logAiUsage({
      userId: meta.userId,
      classId: meta.classId,
      feature: "tagging",
      model: MODEL,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    });
  }

  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}") as Partial<TagProposal>;
  const difficulty =
    raw.difficulty === "easy" || raw.difficulty === "hard" || raw.difficulty === "medium"
      ? raw.difficulty
      : "medium";
  return {
    standard_id: resolveListId(raw.standard_id, context.standards),
    concept_id: resolveListId(raw.concept_id, context.concepts),
    difficulty,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0))),
    reasoning: String(raw.reasoning ?? "").slice(0, 400),
  };
}

function resolveListId(raw: unknown, items: TagContextItem[]) {
  const value = String(raw ?? "").trim();
  if (!value || value === "null" || value === "undefined") return null;
  const exactId = items.find((item) => item.id === value);
  if (exactId) return exactId.id;
  const lower = value.toLowerCase();
  const byCode = items.find((item) => (item.code ?? "").toLowerCase() === lower);
  if (byCode) return byCode.id;
  const byTitle = items.find(
    (item) => item.title.toLowerCase() === lower || (item.name ?? "").toLowerCase() === lower,
  );
  if (byTitle) return byTitle.id;
  const matches = items.filter((item) => {
    const code = (item.code ?? "").toLowerCase();
    return Boolean(code) && (lower.includes(code) || code.includes(lower));
  });
  matches.sort((a, b) => (b.code?.length ?? 0) - (a.code?.length ?? 0));
  return matches[0]?.id ?? null;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  async function next(): Promise<void> {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

export async function tagQuestionsBatch(
  questionIds: string[],
  context: { standards: TagContextItem[]; concepts: TagContextItem[] },
  meta: { userId: string; classId?: string },
): Promise<{ results: Array<TagProposal & { questionId: string }>; cost: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select("id, stem, choices_json, answer_key, explanation")
    .in("id", questionIds.slice(0, 50));
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const start = await classSpend(meta.classId);
  const results = await mapLimit(rows, 3, async (row) => {
    const choices = Array.isArray(row.choices_json)
      ? (row.choices_json as Array<{ key: string; text: string }>)
      : [];
    const tagged = await tagQuestion(
      row.stem,
      choices,
      row.answer_key ?? "",
      row.explanation ?? undefined,
      context,
      meta,
    );
    return { ...tagged, questionId: row.id };
  });
  const end = await classSpend(meta.classId);
  return { results, cost: Number((end - start).toFixed(6)) };
}

async function classSpend(classId?: string) {
  if (!classId) return 0;
  const admin = createAdminClient();
  const { data } = await admin.from("ai_usage_log").select("cost_usd").eq("class_id", classId);
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}
