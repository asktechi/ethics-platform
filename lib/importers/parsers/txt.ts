import { canonicalToRaw, parseGrammarText } from "@/lib/importers/grammar";
import type { StrategyResult } from "@/lib/importers/types";

export function parseTxt(buffer: Buffer, filename: string): StrategyResult {
  const text = buffer.toString("utf8");
  const parsed = parseGrammarText(text, filename);
  return {
    pattern: parsed.pattern,
    questions: parsed.questions.map(canonicalToRaw),
    canonicalQuestions: parsed.questions,
    warnings: [
      ...parsed.warnings,
      ...(parsed.questions.length === 0 ? [`${filename}: no grammar-v1 questions detected`] : []),
    ],
  };
}
