import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const dir = join(process.cwd(), "fixtures", "samples");

async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.pages ?? []).map((page, index) => ({
      order: index + 1,
      title: (page.text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? `Page ${index + 1}`,
      body: (page.text ?? "").trim(),
    }));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseDocx(buffer) {
  const { value } = await mammoth.convertToMarkdown({ buffer });
  return value
    .split(/\n(?=#{1,3}\s+)/)
    .map((chunk, index) => {
      const lines = chunk.trim().split("\n");
      return {
        order: index + 1,
        title: lines[0]?.replace(/^#{1,6}\s+/, "").trim(),
        body: lines.slice(1).join("\n").trim(),
      };
    })
    .filter((slide) => slide.title || slide.body);
}

async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(/slide(\d+)/i.exec(a)?.[1] ?? 0) - Number(/slide(\d+)/i.exec(b)?.[1] ?? 0));
  const slides = [];
  for (const [index, name] of files.entries()) {
    const xml = await zip.files[name].async("string");
    const runs = [...xml.matchAll(/<a:t(?![a-zA-Z])[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean);
    slides.push({ order: index + 1, title: runs[0], body: runs.slice(1).join("\n") });
  }
  return slides;
}

const pdf = await parsePdf(await readFile(join(dir, "sample-ethics-1.pdf")));
const docx = await parseDocx(await readFile(join(dir, "sample-ethics-2.docx")));
const pptx = await parsePptx(await readFile(join(dir, "sample-ethics-3.pptx")));

console.log(JSON.stringify({
  pdf: { count: pdf.length, titles: pdf.map((s) => s.title) },
  docx: { count: docx.length, titles: docx.map((s) => s.title) },
  pptx: { count: pptx.length, titles: pptx.map((s) => s.title) },
}, null, 2));
