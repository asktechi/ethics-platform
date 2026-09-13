import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importFile } from "@/lib/importers/index.ts";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env) || !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

const fixtures = join(process.cwd(), "fixtures", "samples");

async function parseNamed(name) {
  const buffer = readFileSync(join(fixtures, name));
  return importFile(buffer, name);
}

const csv = await parseNamed("questions-import-5.csv");
pass(
  "1 CSV 5q 3-choice",
  csv.questions.length === 5 &&
    csv.questions.every((row) => row.choices.length === 3 && row.answer_key && row.explanation) &&
    csv.questions.every((row) => row.warnings.length === 0),
  `${csv.questions.length} q, warnings=${csv.questions.reduce((sum, row) => sum + row.warnings.length, 0)} pattern=${csv.detectedPattern}`,
);

const xlsx = await parseNamed("questions-import-5.xlsx");
pass(
  "2 XLSX 5q 4-choice",
  xlsx.questions.length === 5 && xlsx.questions.every((row) => row.choices.length === 4 && row.answer_key),
  `${xlsx.questions.length} q pattern=${xlsx.detectedPattern} answers=${xlsx.questions.map((row) => row.answer_key).join("")}`,
);

const docx = await parseNamed("questions-import-3.docx");
pass(
  "3 DOCX 3 numbered",
  docx.questions.length === 3 && docx.questions.every((row) => row.choices.length >= 3 && row.answer_key),
  `${docx.questions.length} q pattern=${docx.detectedPattern} keys=${docx.questions.map((row) => row.answer_key).join("")}`,
);

const pdf = await parseNamed("questions-import-4.pdf");
pass(
  "4 PDF 4 pages",
  pdf.questions.length === 4 && pdf.questions.every((row) => row.choices.length >= 3 && row.answer_key),
  `${pdf.questions.length} q pattern=${pdf.detectedPattern} keys=${pdf.questions.map((row) => row.answer_key).join("")}`,
);

const pptx = await parseNamed("questions-import-vignette.pptx");
pass(
  "5 PPTX vignette",
  pptx.questions.length === 2 &&
    pptx.detectedPattern === "vignette" &&
    pptx.questions.every((row) => row.choices.length === 4 && row.answer_key === "B"),
  `${pptx.questions.length} q pattern=${pptx.detectedPattern} keys=${pptx.questions.map((row) => row.answer_key).join("")}`,
);

const txt = await parseNamed("questions-import-3.txt");
pass(
  "6 TXT 3 Q-blocks",
  txt.questions.length === 3 && txt.questions.every((row) => row.answer_key === "A"),
  `${txt.questions.length} q keys=${txt.questions.map((row) => row.answer_key).join("")}`,
);

const many = await parseNamed("questions-import-200.csv");
pass("200-row CSV parse", many.questions.length === 200, `${many.questions.length} q`);

const edited = csv.questions.map((row, index) =>
  index === 0 ? { ...row, stem: `${row.stem} [edited in review]` } : row,
);
const afterDelete = edited.slice(0, 4);
pass(
  "review local edit+delete",
  afterDelete.length === 4 && afterDelete[0].stem.includes("[edited in review]"),
  `rows=${afterDelete.length}`,
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  pass("integration skipped", false, "missing supabase env");
} else {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: users } = await admin.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;
  const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
  const { data: klass, error: classError } = await admin
    .from("classes")
    .insert({
      level_id: level.id,
      title: `Phase 5.6 import ${Date.now()}`,
      audience: "Importer verify",
      created_by: userId,
    })
    .select("id")
    .single();
  if (classError) throw new Error(classError.message);

  const { count: before } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("class_id", klass.id)
    .is("deleted_at", null);

  await parseNamed("questions-import-5.csv");
  const { count: afterParse } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("class_id", klass.id)
    .is("deleted_at", null);
  pass("no DB write on parse", (before ?? 0) === 0 && (afterParse ?? 0) === 0, `before=${before} afterParse=${afterParse}`);

  const { data: batch, error: batchError } = await admin
    .from("import_batches")
    .insert({
      class_id: klass.id,
      filename: "questions-import-5.csv (review)",
      question_count: afterDelete.length,
      imported_by: userId,
    })
    .select("id")
    .single();
  if (batchError) throw new Error(batchError.message);
  const { data: inserted, error: insertError } = await admin
    .from("questions")
    .insert(
      afterDelete.map((question) => ({
        class_id: klass.id,
        stem: question.stem,
        choices_json: question.choices,
        answer_key: question.answer_key,
        explanation: question.explanation,
        source: "imported",
        approved: false,
        rejected: false,
        tag_approved: false,
        created_by: userId,
        import_batch_id: batch.id,
      })),
    )
    .select("id");
  if (insertError) throw new Error(insertError.message);
  const { count: afterCommit } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("class_id", klass.id)
    .is("deleted_at", null);
  pass(
    "confirm writes 4 rows",
    (inserted?.length ?? 0) === 4 && (afterCommit ?? 0) === 4,
    `inserted=${inserted?.length} afterCommit=${afterCommit}`,
  );
}

console.log(JSON.stringify({ results }, null, 2));
if (results.some((item) => !item.ok)) process.exit(1);
process.exit(0);
