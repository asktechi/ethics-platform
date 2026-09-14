import "server-only";
import OpenAI from "openai";
import { getOpenAiKey, logAiUsage } from "@/lib/ai/usage";

const MODEL = "gpt-4o-mini";

export async function generateAdaptiveHint(input: {
  userId: string;
  classId?: string | null;
  stem: string;
  choices: Array<{ key: string; text: string }>;
}): Promise<{ hint: string; inputTokens: number; outputTokens: number; mocked: boolean }> {
  const fallback =
    "Think about which Standard the vignette is testing, then eliminate choices that ignore a duty you already identified.";
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { hint: fallback, inputTokens: 0, outputTokens: 0, mocked: true };
  }

  const client = new OpenAI({ apiKey: getOpenAiKey() });
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content:
          "The student is answering this CFA ethics question. Provide a single-sentence nudge that helps them think about the correct Standard without revealing the answer. Maximum 25 words.",
      },
      {
        role: "user",
        content: [
          input.stem,
          ...input.choices.map((choice) => `${choice.key}) ${choice.text}`),
        ].join("\n"),
      },
    ],
  });

  const hint = (response.choices[0]?.message?.content ?? fallback).trim().replace(/^["']|["']$/g, "");
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  await logAiUsage({
    userId: input.userId,
    classId: input.classId,
    feature: "hint",
    model: MODEL,
    inputTokens,
    outputTokens,
  });
  const words = hint.split(/\s+/).filter(Boolean);
  return {
    hint: words.slice(0, 25).join(" ") || fallback,
    inputTokens,
    outputTokens,
    mocked: false,
  };
}
