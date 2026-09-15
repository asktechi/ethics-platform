import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
};

export type AiFeature = "tagging" | "generation" | "hint" | "image_generation";

export const IMAGE_GENERATION_COST_USD = 0.04;
export const IMAGE_DAILY_CAP = Number(process.env.IMAGE_GENERATION_DAILY_CAP ?? 100) || 100;

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const rate = RATES[model] ?? RATES["gpt-4o-mini"];
  return Number((inputTokens * rate.input + outputTokens * rate.output).toFixed(6));
}

export async function logAiUsage(input: {
  userId: string;
  classId?: string | null;
  feature: AiFeature;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}) {
  const cost =
    typeof input.costUsd === "number"
      ? Number(input.costUsd.toFixed(6))
      : estimateCostUsd(input.model, input.inputTokens ?? 0, input.outputTokens ?? 0);
  const admin = createAdminClient();
  const { error } = await admin.from("ai_usage_log").insert({
    user_id: input.userId,
    class_id: input.classId ?? null,
    feature: input.feature,
    model: input.model,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    cost_usd: cost,
  });
  if (error) console.warn("[ai] usage log failed", error.message);
  return cost;
}

export async function classAiSpend(classId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_usage_log")
    .select("cost_usd")
    .eq("class_id", classId);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}

export async function classImageSpendToday(classId: string) {
  const admin = createAdminClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await admin
    .from("ai_usage_log")
    .select("id, cost_usd")
    .eq("class_id", classId)
    .eq("feature", "image_generation")
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  const count = data?.length ?? 0;
  const spend = (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
  return { count, spend };
}

export function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  return key;
}
