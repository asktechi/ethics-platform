import { fileTypeFromBuffer } from "file-type";
import type { ImportFileType } from "@/lib/importers/types";

function extensionOf(filename: string) {
  return filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

export async function detectFileType(buffer: Buffer, filename: string): Promise<ImportFileType> {
  const ext = extensionOf(filename);
  if (ext === ".csv") return "csv";
  if (ext === ".tsv") return "tsv";
  if (ext === ".xlsx") return "xlsx";
  if (ext === ".xls") return "xls";
  if (ext === ".docx") return "docx";
  if (ext === ".doc") return "doc";
  if (ext === ".pdf") return "pdf";
  if (ext === ".pptx") return "pptx";
  if (ext === ".txt" || ext === ".md") return "txt";

  const sniffed = await fileTypeFromBuffer(buffer).catch(() => undefined);
  const mime = sniffed?.mime ?? "";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (mime === "application/vnd.ms-excel") return "xls";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/msword") return "doc";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mime === "text/csv") return "csv";
  if (mime.startsWith("text/")) return "txt";

  const head = buffer.subarray(0, 8).toString("utf8");
  if (head.startsWith("%PDF")) return "pdf";
  if (head.startsWith("PK")) return "unknown";
  return "unknown";
}

export function validQuestionScore(stem: string, choiceCount: number) {
  if (stem.trim().length < 20) return 0;
  if (choiceCount >= 2) return 2;
  return 1;
}
