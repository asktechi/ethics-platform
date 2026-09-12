import JSZip from "jszip";
import {
  collapseIfNeeded,
  type ParseResult,
  type ParsedSlide,
} from "@/lib/parsers/types";

function extractTextRuns(xml: string): string[] {
  const runs: string[] = [];
  const pattern = /<a:t(?![a-zA-Z])[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (text) runs.push(text);
  }
  return runs;
}

function isTitleShape(xmlChunk: string): boolean {
  return /<p:ph[^>]*type="(title|ctrTitle|subTitle)"/i.test(xmlChunk);
}

function parseSlideXml(xml: string, order: number): ParsedSlide {
  const shapes = xml.split(/<p:sp[\s>]/).slice(1);
  const titleRuns: string[] = [];
  const bodyRuns: string[] = [];

  for (const shape of shapes) {
    const runs = extractTextRuns(shape);
    if (runs.length === 0) continue;
    if (isTitleShape(shape) && titleRuns.length === 0) {
      titleRuns.push(...runs);
    } else {
      bodyRuns.push(...runs);
    }
  }

  if (titleRuns.length === 0) {
    const all = extractTextRuns(xml);
    return {
      order,
      title: all[0] ?? `Slide ${order}`,
      body: all.slice(1).join("\n"),
      cue: "",
      speaker_note: "",
    };
  }

  return {
    order,
    title: titleRuns[0] ?? `Slide ${order}`,
    body: [...titleRuns.slice(1), ...bodyRuns].join("\n"),
    cue: "",
    speaker_note: "",
  };
}

export async function parsePptx(buffer: Buffer, filename: string): Promise<ParseResult> {
  const warnings: string[] = [
    "PPTX text extracted with the JSZip fallback parser. Full-fidelity conversion is planned for Phase 3.5.",
  ];
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const left = Number(/slide(\d+)\.xml$/i.exec(a)?.[1] ?? 0);
      const right = Number(/slide(\d+)\.xml$/i.exec(b)?.[1] ?? 0);
      return left - right;
    });

  const slides: ParsedSlide[] = [];
  for (let index = 0; index < slideFiles.length; index += 1) {
    const name = slideFiles[index];
    const xml = await zip.files[name].async("string");
    slides.push(parseSlideXml(xml, index + 1));
  }

  if (slides.length === 0) {
    warnings.push("No slide XML parts were found in the PPTX package.");
  }

  return {
    slides: collapseIfNeeded(slides, warnings),
    metadata: {
      filename,
      source: "pptx-fallback",
      slideFiles: slideFiles.length,
      warnings,
    },
  };
}

export { parsePptx as parse };
