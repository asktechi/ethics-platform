import mammoth from "mammoth";
import { parseQuestionBlocks } from "@/lib/parsers/questions/text";
import type { ParseQuestionsResult } from "@/lib/parsers/questions/types";

type MammothMarkdown = typeof mammoth & {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseQuestionsDocx(
  buffer: Buffer,
  filename: string,
): Promise<ParseQuestionsResult> {
  const { value } = await (mammoth as MammothMarkdown).convertToMarkdown({ buffer });
  const parsed = parseQuestionBlocks(value);
  if (parsed.questions.length === 0) {
    parsed.warnings.push(`${filename}: DOCX converted but no question pattern matched.`);
  }
  return parsed;
}
