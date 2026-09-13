import { PDFParse } from "pdf-parse";
import { parseOneProseBlock, parseProseBlocks } from "@/lib/importers/prose";
import { pickBestStrategy } from "@/lib/importers/normalize";
import type { StrategyResult } from "@/lib/importers/types";

export async function parsePdf(buffer: Buffer, filename: string): Promise<StrategyResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages ?? [];
    const perPage = pages.flatMap((page, index) => {
      const text = page.text ?? "";
      const one = parseOneProseBlock(text, undefined, index + 1);
      if (one && (one.choices.length >= 2 || parseProseBlocks(text).length === 1)) {
        return [{ ...one, slide_or_page: index + 1 }];
      }
      return parseProseBlocks(text).map((question) => ({ ...question, slide_or_page: index + 1 }));
    });
    const joined = pages.map((page) => page.text ?? "").join("\n\n");
    const whole = parseProseBlocks(joined);
    const best = pickBestStrategy([
      { questions: perPage },
      { questions: whole },
    ]);
    return {
      pattern: best.questions === perPage ? "page-chunks" : "numbered-prose",
      questions: best.questions,
      warnings: best.questions.length === 0 ? [`${filename}: PDF text extracted but no question pattern matched`] : [],
    };
  } finally {
    await parser.destroy?.();
  }
}
