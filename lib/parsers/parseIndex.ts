import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { parseCsv } from "@/lib/parsers/parseCsv";
import { parseDocx } from "@/lib/parsers/parseDocx";
import { parsePdf } from "@/lib/parsers/parsePdf";
import { parsePptx } from "@/lib/parsers/parsePptx";
import { parseText } from "@/lib/parsers/parseText";
import { UnsupportedFormatError, type ParseResult } from "@/lib/parsers/types";

const EXT_MAP: Record<string, string> = {
  ".txt": "text",
  ".md": "text",
  ".pdf": "pdf",
  ".docx": "docx",
  ".csv": "csv",
  ".pptx": "pptx",
};

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

export async function parseMaterial(
  buffer: Buffer,
  filename: string,
  mimeHint?: string,
): Promise<ParseResult> {
  const sniffed = await fileTypeFromBuffer(buffer).catch(() => undefined);
  const ext = extensionOf(filename);
  const mime = sniffed?.mime ?? mimeHint ?? "";

  let kind = EXT_MAP[ext];
  if (!kind) {
    if (mime === "application/pdf") kind = "pdf";
    else if (mime.includes("wordprocessingml")) kind = "docx";
    else if (mime.includes("presentationml") || mime.includes("powerpoint")) kind = "pptx";
    else if (mime.startsWith("text/")) kind = "text";
  }

  if (!kind) {
    throw new UnsupportedFormatError(filename, mime);
  }

  switch (kind) {
    case "text":
      return parseText(buffer, filename);
    case "pdf":
      return parsePdf(buffer, filename);
    case "docx":
      return parseDocx(buffer, filename);
    case "csv":
      return parseCsv(buffer, filename);
    case "pptx":
      return parsePptx(buffer, filename);
    default:
      throw new UnsupportedFormatError(filename, mime);
  }
}

export function materialTypeFromFilename(filename: string):
  | "text"
  | "pptx"
  | "pdf"
  | "image"
  | "question_set"
  | "docx"
  | "csv" {
  const ext = extensionOf(filename);
  if (ext === ".txt" || ext === ".md") return "text";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".csv") return "csv";
  if (ext === ".pptx") return "pptx";
  return "text";
}
