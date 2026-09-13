import mammoth from "mammoth";
import { canonicalToRaw, parseGrammarText } from "@/lib/importers/grammar";
import type { StrategyResult } from "@/lib/importers/types";

function extractReadableDoc(buffer: Buffer) {
  const asLatin = buffer.toString("latin1");
  const chunks = asLatin.match(/[\x20-\x7E]{8,}/g) ?? [];
  return chunks.join("\n");
}

export async function parseDocx(buffer: Buffer, filename: string, legacy = false): Promise<StrategyResult> {
  const warnings: string[] = [];
  if (legacy) {
    warnings.push(`${filename}: legacy .doc — extracted readable text; prefer .docx.`);
  }

  let text = "";
  try {
    const extracted = await mammoth.extractRawText({ buffer });
    text = extracted.value ?? "";
  } catch {
    text = extractReadableDoc(buffer);
  }
  if (!text.trim()) {
    text = extractReadableDoc(buffer);
  }

  const parsed = parseGrammarText(text, filename);
  return {
    pattern: parsed.pattern,
    questions: parsed.questions.map(canonicalToRaw),
    canonicalQuestions: parsed.questions,
    warnings: [
      ...warnings,
      ...parsed.warnings,
      ...(parsed.questions.length === 0 ? [`${filename}: no grammar-v1 questions detected`] : []),
    ],
  };
}
