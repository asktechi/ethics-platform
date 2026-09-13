import * as XLSX from "xlsx";
import { rowsToQuestions } from "@/lib/importers/tabular";
import type { StrategyResult } from "@/lib/importers/types";

export function parseXlsx(buffer: Buffer, filename: string): StrategyResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { pattern: "table", questions: [], warnings: [`${filename}: workbook has no sheets`] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  const mapped = rowsToQuestions(rows.map((row) => row.map((cell) => String(cell ?? ""))), filename);
  return {
    pattern: mapped.usedHeaders ? "table" : "positional-table",
    questions: mapped.questions,
    warnings: mapped.warnings,
  };
}
