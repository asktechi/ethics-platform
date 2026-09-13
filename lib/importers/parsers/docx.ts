import JSZip from "jszip";
import mammoth from "mammoth";
import { pickBestStrategy } from "@/lib/importers/normalize";
import { parseOneProseBlock, parseProseBlocks } from "@/lib/importers/prose";
import { rowsToQuestions } from "@/lib/importers/tabular";
import { extractWordText } from "@/lib/importers/xml";
import type { StrategyResult } from "@/lib/importers/types";

type MammothMarkdown = typeof mammoth & {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

function paragraphsFromDocXml(xml: string) {
  return xml
    .split(/<w:p[\s>]/)
    .slice(1)
    .map((paragraph) => extractWordText(paragraph).join(""))
    .filter((line) => line.trim().length > 0);
}

function unescapeMarkdown(value: string) {
  return value.replace(/\\([.\\()\-])/g, "$1");
}

function tableRowsFromDocXml(xml: string) {
  const tables = xml.split(/<w:tbl[\s>]/).slice(1);
  const allRows: string[][] = [];
  for (const table of tables) {
    const rows = table.split(/<w:tr[\s>]/).slice(1);
    for (const row of rows) {
      const cells = row.split(/<w:tc[\s>]/).slice(1).map((cell) => extractWordText(cell).join(" ").trim());
      if (cells.some(Boolean)) allRows.push(cells);
    }
  }
  return allRows;
}

function extractReadableDoc(buffer: Buffer) {
  const asLatin = buffer.toString("latin1");
  const chunks = asLatin.match(/[\x20-\x7E]{8,}/g) ?? [];
  return chunks.join("\n");
}

export async function parseDocx(buffer: Buffer, filename: string, legacy = false): Promise<StrategyResult> {
  const warnings: string[] = [];
  if (legacy) {
    warnings.push(`${filename}: legacy .doc — extracted readable text; prefer .docx for tables.`);
  }

  let tableResult: StrategyResult = { pattern: "table", questions: [], warnings: [] };
  let xmlParagraphs: string[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const document = zip.file("word/document.xml");
    if (document) {
      const xml = await document.async("string");
      xmlParagraphs = paragraphsFromDocXml(xml);
      const rows = tableRowsFromDocXml(xml);
      if (rows.length) {
        const mapped = rowsToQuestions(rows, filename);
        tableResult = { pattern: "table", questions: mapped.questions, warnings: mapped.warnings };
      }
    }
  } catch {
    // not a zip / not docx
  }

  let markdown = "";
  try {
    const converted = await (mammoth as MammothMarkdown).convertToMarkdown({ buffer });
    markdown = unescapeMarkdown(converted.value);
  } catch {
    markdown = extractReadableDoc(buffer);
  }

  const fromXml = parseProseBlocks(xmlParagraphs.join("\n"));
  const numbered = parseProseBlocks(markdown);
  const blankBlocks = markdown
    .split(/\n{2,}/)
    .map((chunk) => parseOneProseBlock(chunk))
    .filter((question): question is NonNullable<typeof question> => Boolean(question && question.choices.length >= 2));

  const best = pickBestStrategy([
    { questions: tableResult.questions },
    { questions: fromXml },
    { questions: numbered },
    { questions: blankBlocks },
  ]);

  let pattern = "numbered-prose";
  if (best.questions === tableResult.questions && tableResult.questions.length) pattern = "table";
  else if (best.questions === fromXml) pattern = "numbered-prose";
  else if (best.questions === blankBlocks) pattern = "blank-line-blocks";

  return {
    pattern,
    questions: best.questions,
    warnings: [
      ...warnings,
      ...tableResult.warnings,
      ...(best.questions.length === 0 ? [`${filename}: no question pattern matched`] : []),
    ],
  };
}
