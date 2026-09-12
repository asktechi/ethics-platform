import { PDFParse } from "pdf-parse";
import {
  collapseIfNeeded,
  firstLine,
  restAfterFirstLine,
  type ParseResult,
  type ParsedSlide,
} from "@/lib/parsers/types";

export async function parsePdf(buffer: Buffer, filename: string): Promise<ParseResult> {
  const warnings: string[] = [];
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const slides: ParsedSlide[] = (result.pages ?? []).map((page, index) => {
      const text = (page.text ?? "").replace(/\r\n/g, "\n").trim();
      return {
        order: index + 1,
        title: firstLine(text) || `Page ${index + 1}`,
        body: restAfterFirstLine(text),
        cue: "",
        speaker_note: "",
      };
    });

    if (slides.length === 0 && result.text?.trim()) {
      slides.push({
        order: 1,
        title: firstLine(result.text),
        body: restAfterFirstLine(result.text),
        cue: "",
        speaker_note: "",
      });
    }

    return {
      slides: collapseIfNeeded(slides, warnings),
      metadata: {
        filename,
        source: "pdf",
        pageCount: result.pages?.length ?? slides.length,
        warnings,
      },
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export { parsePdf as parse };
