import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const rate = RATES[model] ?? RATES["gpt-4o-mini"];
  return Number((inputTokens * rate.input + outputTokens * rate.output).toFixed(6));
}

export async function logAiUsage(input: {
  userId: string;
  classId?: string | null;
  feature: "tagging" | "generation" | "hint";
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const cost = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);
  const admin = createAdminClient();
  const { error } = await admin.from("ai_usage_log").insert({
    user_id: input.userId,
    class_id: input.classId ?? null,
    feature: input.feature,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
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

export function getOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  return key;
}
