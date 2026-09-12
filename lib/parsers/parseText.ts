import {
  collapseIfNeeded,
  firstLine,
  restAfterFirstLine,
  type ParseResult,
  type ParsedSlide,
} from "@/lib/parsers/types";

export function parseText(buffer: Buffer, filename: string): ParseResult {
  const text = buffer.toString("utf8").replace(/\r\n/g, "\n").trim();
  const warnings: string[] = [];
  const parts = text.split(/\n---\n/);

  const slides: ParsedSlide[] = parts.map((part, index) => {
    const chunk = part.trim();
    return {
      order: index + 1,
      title: firstLine(chunk) || `Slide ${index + 1}`,
      body: restAfterFirstLine(chunk),
      cue: "",
      speaker_note: "",
    };
  });

  return {
    slides: collapseIfNeeded(slides, warnings),
    metadata: { filename, source: "text", warnings },
  };
}

export { parseText as parse };
