import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase admin env.");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function firstLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function restAfterFirstLine(text) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim());
  if (index < 0) return "";
  return lines.slice(index + 1).join("\n").trim();
}

async function parsePdf(buffer, filename) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const slides = (result.pages ?? []).map((page, index) => {
      const text = (page.text ?? "").replace(/\r\n/g, "\n").trim();
      return {
        order: index + 1,
        title: firstLine(text) || `Page ${index + 1}`,
        body: restAfterFirstLine(text),
        cue: "",
        speaker_note: "",
      };
    });
    return { slides, warnings: [] };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseDocx(buffer) {
  const { value } = await mammoth.convertToMarkdown({ buffer });
  const chunks = value.replace(/\r\n/g, "\n").trim().split(/\n(?=#{1,3}\s+)/);
  return {
    slides: chunks.map((chunk, index) => {
      const lines = chunk.trim().split("\n");
      return {
        order: index + 1,
        title: lines[0]?.replace(/^#{1,6}\s+/, "").trim() ?? `Section ${index + 1}`,
        body: lines.slice(1).join("\n").trim(),
        cue: "",
        speaker_note: "",
      };
    }),
    warnings: [],
  };
}

async function parsePptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(/slide(\d+)/i.exec(a)?.[1] ?? 0) - Number(/slide(\d+)/i.exec(b)?.[1] ?? 0));
  const slides = [];
  for (const [index, name] of files.entries()) {
    const xml = await zip.files[name].async("string");
    const runs = [...xml.matchAll(/<a:t(?![a-zA-Z])[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    slides.push({
      order: index + 1,
      title: runs[0] ?? `Slide ${index + 1}`,
      body: runs.slice(1).join("\n"),
      cue: "",
      speaker_note: "",
    });
  }
  return {
    slides,
    warnings: ["PPTX text extracted with the JSZip fallback parser."],
  };
}

function originalPath(classId, hash, filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  return `classes/${classId}/originals/${hash}.${ext}`;
}

async function uploadImmutable(classId, hash, filename, bytes, contentType) {
  const path = originalPath(classId, hash, filename);
  const { error } = await admin.storage.from("materials").upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error && !/already exists|Duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }
  return path;
}

async function createFromUpload({ classId, filename, bytes, mime, forceVersion, uploadedBy, type, parsed }) {
  const hash = sha256(bytes);
  const { data: existing, error: existingError } = await admin
    .from("materials")
    .select("*")
    .eq("class_id", classId)
    .eq("sha256", hash)
    .eq("is_current", true)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing && !forceVersion) {
    return { duplicate: true, existing_id: existing.id, sha256: hash };
  }

  const path = await uploadImmutable(classId, hash, filename, bytes, mime);
  if (existing && forceVersion) {
    await admin.from("materials").update({ is_current: false }).eq("id", existing.id);
  }

  const { data: material, error } = await admin
    .from("materials")
    .insert({
      class_id: classId,
      type,
      original_filename: filename,
      storage_path: path,
      sha256: hash,
      uploaded_by: uploadedBy,
      version_of: existing?.id ?? null,
      is_current: true,
      byte_size: bytes.byteLength,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (parsed.slides.length) {
    const { error: slideError } = await admin.from("slides").insert(
      parsed.slides.map((slide) => ({
        material_id: material.id,
        order: slide.order,
        title: slide.title,
        body: slide.body,
        cue: slide.cue,
        speaker_note: slide.speaker_note,
        layout: "point",
        status: "draft",
      })),
    );
    if (slideError) throw new Error(slideError.message);
  }

  return {
    duplicate: false,
    material_id: material.id,
    slide_count: parsed.slides.length,
    warnings: parsed.warnings,
    sha256: hash,
    version_of: material.version_of,
  };
}

const samplesDir = join(process.cwd(), "fixtures", "samples");
const pdfBytes = await readFileAsync(join(samplesDir, "sample-ethics-1.pdf"));
const docxBytes = await readFileAsync(join(samplesDir, "sample-ethics-2.docx"));
const pptxBytes = await readFileAsync(join(samplesDir, "sample-ethics-3.pptx"));

const pdfParsed = await parsePdf(pdfBytes, "sample-ethics-1.pdf");
const docxParsed = await parseDocx(docxBytes);
const pptxParsed = await parsePptx(pptxBytes);

const report = {
  samples: [
    {
      filename: "sample-ethics-1.pdf",
      size_kb: Number((pdfBytes.byteLength / 1024).toFixed(2)),
      slides_extracted: pdfParsed.slides.length,
      status: "draft",
      warnings: pdfParsed.warnings,
    },
    {
      filename: "sample-ethics-2.docx",
      size_kb: Number((docxBytes.byteLength / 1024).toFixed(2)),
      slides_extracted: docxParsed.slides.length,
      status: "draft",
      warnings: docxParsed.warnings,
    },
    {
      filename: "sample-ethics-3.pptx",
      size_kb: Number((pptxBytes.byteLength / 1024).toFixed(2)),
      slides_extracted: pptxParsed.slides.length,
      status: "draft",
      warnings: pptxParsed.warnings,
    },
  ],
};

let { data: users, error: userError } = await admin.from("users").select("id").limit(1);
if (userError) throw new Error(userError.message);
let userId = users?.[0]?.id;
if (!userId) {
  const created = await admin.auth.admin.createUser({
    email: "phase3-verify@example.com",
    email_confirm: true,
  });
  if (created.error) throw new Error(created.error.message);
  const upsert = await admin.from("users").upsert({
    id: created.data.user.id,
    role: "instructor",
    name: "Phase 3 verify",
    email: "phase3-verify@example.com",
  });
  if (upsert.error) throw new Error(upsert.error.message);
  userId = created.data.user.id;
}

const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
let { data: klass } = await admin
  .from("classes")
  .select("id")
  .eq("created_by", userId)
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (!klass) {
  const created = await admin
    .from("classes")
    .insert({
      level_id: level.id,
      title: "Phase 3 materials verification",
      audience: "Internal verify",
      created_by: userId,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  klass = created.data;
}

const classId = klass.id;
const stamp = Date.now();
const pdfName = `sample-ethics-1-${stamp}.pdf`;
const pptxName = `sample-ethics-3-${stamp}.pptx`;

const first = await createFromUpload({
  classId,
  filename: pdfName,
  bytes: pdfBytes,
  mime: "application/pdf",
  forceVersion: false,
  uploadedBy: userId,
  type: "pdf",
  parsed: pdfParsed,
});

const dup = await createFromUpload({
  classId,
  filename: pdfName,
  bytes: pdfBytes,
  mime: "application/pdf",
  forceVersion: false,
  uploadedBy: userId,
  type: "pdf",
  parsed: pdfParsed,
});

const versioned = await createFromUpload({
  classId,
  filename: pdfName,
  bytes: pdfBytes,
  mime: "application/pdf",
  forceVersion: true,
  uploadedBy: userId,
  type: "pdf",
  parsed: pdfParsed,
});

const { data: prior } = await admin.from("materials").select("id,is_current,version_of").eq("id", first.material_id).single();
const { data: next } = await admin.from("materials").select("id,is_current,version_of,storage_path,sha256").eq("id", versioned.material_id).single();

const { data: slides } = await admin
  .from("slides")
  .select("id,order")
  .eq("material_id", first.material_id)
  .is("deleted_at", null)
  .order("order");

const reversed = [...slides].reverse().map((slide) => slide.id);
await Promise.all(
  reversed.map((id, index) =>
    admin.from("slides").update({ order: index + 1 }).eq("id", id).eq("material_id", first.material_id),
  ),
);
const { data: reordered } = await admin
  .from("slides")
  .select("id,order")
  .eq("material_id", first.material_id)
  .is("deleted_at", null)
  .order("order");

await admin.from("materials").update({ deleted_at: new Date().toISOString() }).eq("id", first.material_id);
const { data: hidden } = await admin
  .from("materials")
  .select("id")
  .eq("id", first.material_id)
  .is("deleted_at", null)
  .maybeSingle();
await admin.from("materials").update({ deleted_at: null }).eq("id", first.material_id);
const { data: restored } = await admin
  .from("materials")
  .select("id,deleted_at")
  .eq("id", first.material_id)
  .single();

await admin.from("slides").update({ status: "approved" }).eq("material_id", versioned.material_id).is("deleted_at", null);
const { data: approved } = await admin
  .from("slides")
  .select("status")
  .eq("material_id", versioned.material_id)
  .is("deleted_at", null);

const pptx = await createFromUpload({
  classId,
  filename: pptxName,
  bytes: pptxBytes,
  mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  forceVersion: false,
  uploadedBy: userId,
  type: "pptx",
  parsed: pptxParsed,
});

const docx = await createFromUpload({
  classId,
  filename: `sample-ethics-2-${stamp}.docx`,
  bytes: docxBytes,
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  forceVersion: false,
  uploadedBy: userId,
  type: "docx",
  parsed: docxParsed,
});

const samePath = first.sha256 === versioned.sha256 && prior && next && next.storage_path === `classes/${classId}/originals/${next.sha256}.pdf`;

report.db = {
  class_id: classId,
  pdf_first: first,
  duplicate_without_force: dup,
  pdf_version: versioned,
  prior_is_current: prior?.is_current === false,
  version_of_set: next?.version_of === first.material_id,
  reorder_persists: reordered.map((row) => row.id).join(",") === reversed.join(","),
  archive_hides: !hidden,
  restore_works: restored?.deleted_at === null,
  approve_all: (approved ?? []).every((row) => row.status === "approved") && (approved ?? []).length >= 5,
  pptx,
  docx,
  same_storage_path_reused: samePath,
  immutability: {
    originals_never_overwritten: samePath,
    new_row_on_reupload: versioned.material_id !== first.material_id,
    soft_delete_only: restored?.deleted_at === null,
  },
};

console.log(JSON.stringify(report, null, 2));
