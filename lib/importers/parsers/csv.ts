import Papa from "papaparse";
import { rowsToQuestions } from "@/lib/importers/tabular";
import type { StrategyResult } from "@/lib/importers/types";

export function parseCsvOrTsv(buffer: Buffer, filename: string, delimiter?: string): StrategyResult {
  const text = buffer.toString("utf8");
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: delimiter ?? (filename.toLowerCase().endsWith(".tsv") ? "\t" : ","),
  });
  const rows = (parsed.data ?? []).map((row) => row.map((cell) => String(cell ?? "")));
  const mapped = rowsToQuestions(rows, filename);
  const warnings = [...mapped.warnings];
  if (parsed.errors.length) {
    warnings.push(`${filename}: ${parsed.errors.slice(0, 4).map((error) => error.message).join("; ")}`);
  }
  return {
    pattern: mapped.usedHeaders ? "table" : "positional-table",
    questions: mapped.questions,
    warnings,
  };
}
