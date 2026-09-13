import { detectFileType } from "@/lib/importers/detect";
import { normalizeQuestion } from "@/lib/importers/normalize";
import { parseCsvOrTsv } from "@/lib/importers/parsers/csv";
import { parseDocx } from "@/lib/importers/parsers/docx";
import { parsePdf } from "@/lib/importers/parsers/pdf";
import { parsePptx } from "@/lib/importers/parsers/pptx";
import { parseTxt } from "@/lib/importers/parsers/txt";
import { parseXlsx } from "@/lib/importers/parsers/xlsx";
import type { ParseResult, StrategyResult } from "@/lib/importers/types";

export type { CanonicalQuestion, ParseResult } from "@/lib/importers/types";

export async function importFile(
  buffer: Buffer,
  filename: string,
  _hint?: string,
): Promise<ParseResult> {
  const fileType = await detectFileType(buffer, filename);
  let strategy: StrategyResult;

  switch (fileType) {
    case "csv":
      strategy = parseCsvOrTsv(buffer, filename, ",");
      break;
    case "tsv":
      strategy = parseCsvOrTsv(buffer, filename, "\t");
      break;
    case "xlsx":
    case "xls":
      strategy = parseXlsx(buffer, filename);
      break;
    case "docx":
      strategy = await parseDocx(buffer, filename, false);
      break;
    case "doc":
      strategy = await parseDocx(buffer, filename, true);
      break;
    case "pdf":
      strategy = await parsePdf(buffer, filename);
      break;
    case "pptx":
      strategy = await parsePptx(buffer, filename);
      break;
    case "txt":
      strategy = parseTxt(buffer, filename);
      break;
    default:
      return {
        file: filename,
        fileType,
        questions: [],
        globalWarnings: [`Unsupported or unrecognized file: ${filename}. Use csv, tsv, xlsx, xls, docx, doc, pdf, pptx, txt, or md.`],
        detectedPattern: "unknown",
      };
  }

  return {
    file: filename,
    fileType,
    questions: strategy.questions.map((question) => normalizeQuestion(question, filename)),
    globalWarnings: strategy.warnings,
    detectedPattern: strategy.pattern,
  };
}
