import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

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
  results.push({ step, ok, detail: detail ?? "" });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sidebar = read("components/shell/sidebar-nav.tsx");
const levelCard = read("components/LevelCard.tsx");
const classCard = read("components/ClassCard.tsx");
const materialsSrc = read("lib/data/materials.ts");
const classesSrc = read("lib/data/classes.ts");
const levelsSrc = read("lib/data/levels.ts");
const dashboard = read("app/(app)/dashboard/page.tsx");
const levelPage = read("app/(app)/level/[slug]/page.tsx");
const classPage = read("app/(app)/class/[id]/page.tsx");
const materialsPage = read("app/(app)/class/[id]/materials/page.tsx");
const archivedPage = read("app/(app)/classes/archived/page.tsx");
const workspace = read("components/ClassWorkspace.tsx");
const toastSrc = read("components/ClassArchivedToast.tsx");

const listMaterialsFn = materialsSrc.slice(
  materialsSrc.indexOf("export async function listMaterials"),
  materialsSrc.indexOf("export async function getMaterial"),
);

pass("sidebar level href is /level/${slug}", sidebar.includes("href={`/level/${item.slug}`}"), "");
pass("sidebar class href is /class/${id}", sidebar.includes("href={`/class/${item.id}`}"), "");
pass("LevelCard Open goes to /level/${slug}", levelCard.includes("href={`/level/${level.slug}`}"), "");
pass("ClassCard title goes to /class/${id}", classCard.includes("href={`/class/${item.id}`}"), "");
pass("dashboard still fetches listLevels + listRecentClasses", dashboard.includes("listLevels()") && dashboard.includes("listRecentClasses(5)"), "");
pass("level page lists via listClassesByLevel", levelPage.includes("listClassesByLevel(levelDetail.level.id"), "");
pass("class overview loads listMaterials", classPage.includes("listMaterials(detail.id"), "");
pass("materials page loads listMaterials", materialsPage.includes("listMaterials(detail.id"), "");
pass(
  "listMaterials does not filter is_current",
  listMaterialsFn.includes('.eq("class_id", classId)') && !listMaterialsFn.includes("is_current"),
  "",
);
pass(
  "listClassesByLevel hides archived by default",
  classesSrc.includes('.eq("level_id", levelId)') && classesSrc.includes('query.is("deleted_at", null)'),
  "",
);
pass("listLevels uses slug + order", levelsSrc.includes('.eq("slug", slug)') && levelsSrc.includes('.order("order"'), "");
pass(
  "dashboard archived link only when N > 0",
  dashboard.includes("archivedCount > 0") && dashboard.includes("View archived classes (") && dashboard.includes('href="/classes/archived"'),
  "",
);
pass(
  "archived page lists deleted_at IS NOT NULL",
  archivedPage.includes("listArchivedClasses") &&
    archivedPage.includes("Nothing archived") &&
    archivedPage.includes("RestoreArchivedClassButton") &&
    classesSrc.includes('.not("deleted_at", "is", null)'),
  "",
);
pass(
  "archive toast points at /classes/archived",
  toastSrc.includes("Class archived. Restore it from") &&
    toastSrc.includes("/classes/archived") &&
    workspace.includes("ClassArchivedToast"),
  "",
);
pass("existing listRecentClasses still excludes archived", classesSrc.includes("export async function listRecentClasses") && classesSrc.includes('.is("deleted_at", null)'), "");

const { data: intro, error: introError } = await admin
  .from("classes")
  .select("id, title, deleted_at, created_by")
  .eq("title", "Introduction")
  .maybeSingle();
if (introError) throw introError;
pass(
  "live Introduction class is not archived",
  Boolean(intro) && intro.deleted_at == null,
  intro ? `id=${intro.id} deleted_at=${intro.deleted_at}` : "missing",
);

if (intro) {
  const { data: introMaterials, error: introMatError } = await admin
    .from("materials")
    .select("id")
    .eq("class_id", intro.id)
    .is("deleted_at", null);
  if (introMatError) throw introMatError;
  pass(
    "Introduction materials still in DB",
    (introMaterials?.length ?? 0) >= 1,
    `count=${introMaterials?.length ?? 0}`,
  );
}

const { data: level1, error: levelError } = await admin
  .from("levels")
  .select("id, slug")
  .eq("slug", "level-1")
  .maybeSingle();
if (levelError) throw levelError;
pass("level-1 slug exists", level1?.slug === "level-1", level1?.slug ?? "missing");

const { data: owner, error: ownerError } = await admin
  .from("users")
  .select("id")
  .eq("email", "phase3-verify@example.com")
  .maybeSingle();
if (ownerError) throw ownerError;
if (!owner || !level1) {
  pass("seed user + level for create", false, "cannot create navigation fixture");
} else {
  const stamp = Date.now();
  const { data: klass, error: classError } = await admin
    .from("classes")
    .insert({
      level_id: level1.id,
      title: `nav-regression ${stamp}`,
      created_by: owner.id,
    })
    .select("id, title, level_id, deleted_at")
    .single();
  if (classError) throw classError;

  const sha = createHash("sha256").update(`nav-${stamp}`).digest("hex");
  const { data: material, error: materialError } = await admin
    .from("materials")
    .insert({
      class_id: klass.id,
      type: "text",
      original_filename: `nav-regression-${stamp}.txt`,
      storage_path: `classes/${klass.id}/originals/${sha}.txt`,
      sha256: sha,
      uploaded_by: owner.id,
      is_current: true,
    })
    .select("id, class_id, deleted_at, is_current")
    .single();
  if (materialError) throw materialError;

  const { data: listedClasses, error: listClassError } = await admin
    .from("classes")
    .select("id, title")
    .eq("level_id", level1.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (listClassError) throw listClassError;
  pass(
    "listClassesByLevel equivalent includes new class",
    (listedClasses ?? []).some((row) => row.id === klass.id),
    `n=${listedClasses?.length ?? 0}`,
  );

  const { data: listedMaterials, error: listMatError } = await admin
    .from("materials")
    .select("id, original_filename, deleted_at")
    .eq("class_id", klass.id)
    .order("created_at", { ascending: false });
  if (listMatError) throw listMatError;
  const visibleMaterials = (listedMaterials ?? []).filter((row) => !row.deleted_at);
  pass(
    "listMaterials equivalent includes new material",
    visibleMaterials.some((row) => row.id === material.id),
    `n=${visibleMaterials.length}`,
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://ethics-platform.vercel.app";
  async function statusOf(path) {
    const response = await fetch(`${site}${path}`, { redirect: "manual" });
    return response.status;
  }
  const levelStatus = await statusOf(`/level/${level1.slug}`);
  const classStatus = await statusOf(`/class/${klass.id}`);
  const materialsStatus = await statusOf(`/class/${klass.id}/materials`);
  pass(
    "level href resolves (not 404)",
    levelStatus !== 404 && levelStatus !== 500,
    `GET /level/${level1.slug} → ${levelStatus}`,
  );
  pass(
    "class href resolves (not 404)",
    classStatus !== 404 && classStatus !== 500,
    `GET /class/${klass.id} → ${classStatus}`,
  );
  pass(
    "materials href resolves (not 404)",
    materialsStatus !== 404 && materialsStatus !== 500,
    `GET /class/${klass.id}/materials → ${materialsStatus}`,
  );

  const archivedAt = new Date().toISOString();
  const { error: archiveError } = await admin
    .from("classes")
    .update({ deleted_at: archivedAt })
    .eq("id", klass.id);
  if (archiveError) throw archiveError;

  const { data: activeAfterArchive, error: activeAfterError } = await admin
    .from("classes")
    .select("id")
    .eq("level_id", level1.id)
    .is("deleted_at", null);
  if (activeAfterError) throw activeAfterError;
  pass(
    "archived class leaves dashboard/level lists",
    !(activeAfterArchive ?? []).some((row) => row.id === klass.id),
    "",
  );

  const { data: archivedRows, error: archivedError } = await admin
    .from("classes")
    .select("id, title, deleted_at")
    .not("deleted_at", "is", null)
    .eq("id", klass.id);
  if (archivedError) throw archivedError;
  pass(
    "archived class appears in /classes/archived query",
    (archivedRows ?? []).some((row) => row.id === klass.id && row.deleted_at),
    `n=${archivedRows?.length ?? 0}`,
  );

  const archivedStatus = await statusOf("/classes/archived");
  pass(
    "archived route resolves (not 404)",
    archivedStatus !== 404 && archivedStatus !== 500,
    `GET /classes/archived → ${archivedStatus}`,
  );

  const { error: restoreError } = await admin.from("classes").update({ deleted_at: null }).eq("id", klass.id);
  if (restoreError) throw restoreError;

  const { data: activeAfterRestore, error: restoreListError } = await admin
    .from("classes")
    .select("id")
    .eq("level_id", level1.id)
    .is("deleted_at", null);
  if (restoreListError) throw restoreListError;
  pass(
    "restored class is back in dashboard/level lists",
    (activeAfterRestore ?? []).some((row) => row.id === klass.id),
    "",
  );

  const { error: cleanupError } = await admin.from("classes").delete().eq("id", klass.id);
  pass("cleanup nav fixture class", !cleanupError, cleanupError?.message ?? "");
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) process.exit(1);
