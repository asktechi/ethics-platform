import "server-only";
import OpenAI from "openai";
import { getOpenAiKey, logAiUsage } from "@/lib/ai/usage";
import { alignToGrammar } from "@/lib/importers/grammar";

export type GeneratedQuestion = {
  stem: string;
  choices: Array<{ key: string; text: string }>;
  answer_key: string;
  explanation: string;
  reasoning: string;
};

const MODEL = "gpt-4o";

function client() {
  return new OpenAI({ apiKey: getOpenAiKey() });
}

export async function generateQuestions(input: {
  classId: string;
  userId: string;
  standardTitle: string;
  standardBody: string;
  conceptName?: string | null;
  count: number;
  difficulty: "easy" | "medium" | "hard";
  sourceText: string;
  style: "mcq" | "scenario" | "mixed";
}): Promise<GeneratedQuestion[]> {
  const count = Math.min(20, Math.max(1, input.count));
  const out: GeneratedQuestion[] = [];
  for (let index = 0; index < count; index += 1) {
    out.push(await generateOne(input, index + 1));
  }
  return out;
}

async function generateOne(
  input: Parameters<typeof generateQuestions>[0],
  n: number,
): Promise<GeneratedQuestion> {
  const style =
    input.style === "scenario"
      ? "Write a short ethics scenario stem (3-5 sentences) then one question."
      : input.style === "mixed" && n % 2 === 0
        ? "Write a short ethics scenario stem then one question."
        : "Write a direct multiple-choice ethics question.";

  const response = await client().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You write original CFA Institute ethics teaching questions. Ethics reasoning only — no investment advice, no security recommendations, no portfolio construction. Use only the Standard and source text provided. Always return the question as a JSON object with exactly these keys: stem (string), choices (array of {key, text} with keys A/B/C), answer_key (one of A/B/C), explanation (string that begins with 'X is correct because...'). Do not include decorative characters, page numbers, or formatting artifacts. You may include a fourth choice (D) when the item needs it; never truncate extra valid choices. Also include reasoning (string). ${style}`,
      },
      {
        role: "user",
        content: [
          `STANDARD: ${input.standardTitle}`,
          input.standardBody,
          input.conceptName ? `CONCEPT: ${input.conceptName}` : "",
          `DIFFICULTY: ${input.difficulty}`,
          `SOURCE MATERIAL:\n${input.sourceText.slice(0, 6000)}`,
          `This is question ${n} of a set. Do not repeat earlier stems.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  await logAiUsage({
    userId: input.userId,
    classId: input.classId,
    feature: "generation",
    model: MODEL,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}") as Partial<GeneratedQuestion>;
  const choices = Array.isArray(raw.choices)
    ? raw.choices
        .map((choice, index) => ({
          key: String(choice.key ?? String.fromCharCode(65 + index)).toUpperCase().slice(0, 1),
          text: String(choice.text ?? "").trim(),
        }))
        .filter((choice) => choice.text && /^[A-F]$/.test(choice.key))
    : [];
  const draft = {
    stem: String(raw.stem ?? "").trim() || "Untitled generated question",
    choices,
    answer_key: String(raw.answer_key ?? "A").trim().toUpperCase().slice(0, 1),
    explanation: String(raw.explanation ?? "").trim(),
    reasoning: String(raw.reasoning ?? "").trim(),
  };
  const aligned = alignToGrammar(
    {
      stem: draft.stem,
      choices: draft.choices,
      answer_key: draft.answer_key,
      explanation: draft.explanation,
    },
    "ai-generated",
  );
  if (!aligned) return draft;
  return {
    stem: aligned.stem,
    choices: aligned.choices,
    answer_key: aligned.answer_key ?? draft.answer_key,
    explanation: aligned.explanation ?? draft.explanation,
    reasoning: draft.reasoning,
  };
}
