import { parseProseBlocks } from "@/lib/importers/prose";
import type { StrategyResult } from "@/lib/importers/types";

export function parseTxt(buffer: Buffer, filename: string): StrategyResult {
  const text = buffer.toString("utf8");
  const questions = parseProseBlocks(text);
  return {
    pattern: "numbered-prose",
    questions,
    warnings: questions.length === 0 ? [`${filename}: no Q-blocks detected`] : [],
  };
}
