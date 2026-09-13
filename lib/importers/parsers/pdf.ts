import { PDFParse } from "pdf-parse";
import { canonicalToRaw, parseGrammarText } from "@/lib/importers/grammar";
import { pickBestStrategy } from "@/lib/importers/normalize";
import type { CanonicalQuestion, RawQuestion, StrategyResult } from "@/lib/importers/types";

export async function parsePdf(buffer: Buffer, filename: string): Promise<StrategyResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages ?? [];
    const joined = pages.map((page) => page.text ?? "").join("\n\n");
    const whole = parseGrammarText(joined, filename);
    const perPage: RawQuestion[] = [];
    const perPageCanonical: CanonicalQuestion[] = [];
    pages.forEach((page, index) => {
      const parsed = parseGrammarText(page.text ?? "", filename);
      parsed.questions.forEach((question) => {
        const next = {
          ...question,
          source: { ...question.source, slide_or_page: index + 1 },
        };
        perPageCanonical.push(next);
        perPage.push({ ...canonicalToRaw(next), slide_or_page: index + 1 });
      });
    });
    const best = pickBestStrategy([{ questions: whole.questions.map(canonicalToRaw) }, { questions: perPage }]);
    const usePages = best.questions === perPage;
    const canonical = usePages ? perPageCanonical : whole.questions;
    return {
      pattern: canonical.length ? "grammar-v1" : "page-chunks",
      questions: canonical.map(canonicalToRaw),
      canonicalQuestions: canonical,
      warnings: canonical.length === 0 ? [`${filename}: PDF text extracted but no grammar-v1 questions matched`] : [],
    };
  } finally {
    await parser.destroy?.();
  }
}
