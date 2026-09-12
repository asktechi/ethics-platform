import mammoth from "mammoth";
import {
  collapseIfNeeded,
  type ParseResult,
  type ParsedSlide,
} from "@/lib/parsers/types";

type MammothMarkdown = typeof mammoth & {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParseResult> {
  const warnings: string[] = [];
  const { value } = await (mammoth as MammothMarkdown).convertToMarkdown({ buffer });
  const markdown = value.replace(/\r\n/g, "\n").trim();
  const chunks = markdown.split(/\n(?=#{1,3}\s+)/);
  const slides: ParsedSlide[] = chunks
    .map((chunk, index) => {
      const lines = chunk.trim().split("\n");
      const heading = lines[0]?.replace(/^#{1,6}\s+/, "").trim() ?? "";
      const body = lines.slice(1).join("\n").trim();
      return {
        order: index + 1,
        title: heading || `Section ${index + 1}`,
        body,
        cue: "",
        speaker_note: "",
      };
    })
    .filter((slide) => slide.title || slide.body);

  return {
    slides: collapseIfNeeded(slides, warnings),
    metadata: { filename, source: "docx", warnings },
  };
}

export { parseDocx as parse };
