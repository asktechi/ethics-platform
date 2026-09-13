import { PDFParse } from "pdf-parse";
import { parseQuestionBlocks } from "@/lib/parsers/questions/text";
import type { ParseQuestionsResult } from "@/lib/parsers/questions/types";

export async function parseQuestionsPdf(
  buffer: Buffer,
  filename: string,
): Promise<ParseQuestionsResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages ?? [];
    const joined = pages
      .map((page, index) => `[[PAGE ${index + 1}]]\n${page.text ?? ""}`)
      .join("\n\n");
    const parsed = parseQuestionBlocks(joined.replace(/\[\[PAGE \d+\]\]\n/g, "\n"));
    pages.forEach((page, index) => {
      const text = page.text ?? "";
      const starts = /^\s*(?:\d+[.)]|Q\s*\d*[:.)])/m.test(text);
      const endsOpen = /(?:^\s*(?:\(?[A-Da-d]\)|[A-Da-d])[.):]\s+)/m.test(text) && !/answer\s*[:\-]/i.test(text);
      if (starts && endsOpen && index < pages.length - 1) {
        parsed.warnings.push(
          `${filename}: a question appears to start on page ${index + 1} and continue on page ${index + 2}.`,
        );
      }
    });
    if (parsed.questions.length === 0) {
      parsed.warnings.push(`${filename}: PDF text extracted but no question pattern matched.`);
    }
    return parsed;
  } finally {
    await parser.destroy?.();
  }
}
