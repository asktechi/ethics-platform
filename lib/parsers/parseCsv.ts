import Papa from "papaparse";
import {
  collapseIfNeeded,
  type ParseResult,
  type ParsedSlide,
} from "@/lib/parsers/types";

const SLIDE_HEADERS = new Set([
  "title",
  "body",
  "cue",
  "speaker_note",
  "speakernote",
  "speaker note",
  "order",
]);

export function parseCsv(buffer: Buffer, filename: string): ParseResult {
  const warnings: string[] = [];
  const text = buffer.toString("utf8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    warnings.push(`CSV parse notes: ${parsed.errors.slice(0, 3).map((error) => error.message).join("; ")}`);
  }

  const fields = (parsed.meta.fields ?? []).map((field) => field.trim().toLowerCase());
  const looksLikeSlides = fields.some((field) => SLIDE_HEADERS.has(field));

  let slides: ParsedSlide[];
  if (looksLikeSlides) {
    slides = parsed.data.map((row, index) => ({
      order: Number(row.order ?? row.Order ?? index + 1) || index + 1,
      title: row.title ?? row.Title ?? `Row ${index + 1}`,
      body: row.body ?? row.Body ?? "",
      cue: row.cue ?? row.Cue ?? "",
      speaker_note:
        row.speaker_note ??
        row.speakernote ??
        row["speaker note"] ??
        row.Speaker_Note ??
        "",
    }));
  } else {
    const header = fields.join(" | ");
    const rows = parsed.data
      .map((row) =>
        (parsed.meta.fields ?? [])
          .map((field) => String(row[field] ?? "").trim())
          .join(" | "),
      )
      .filter(Boolean);
    slides = [
      {
        order: 1,
        title: filename.replace(/\.[^.]+$/, ""),
        body: [header, ...rows].join("\n"),
        cue: "",
        speaker_note: "",
      },
    ];
  }

  return {
    slides: collapseIfNeeded(slides, warnings),
    metadata: { filename, source: "csv", rowCount: parsed.data.length, warnings },
  };
}

export { parseCsv as parse };
