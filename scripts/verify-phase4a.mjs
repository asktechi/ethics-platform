import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const { data: themes, error: themeError } = await admin
  .from("themes")
  .select("id,name")
  .eq("is_professional_locked", true)
  .is("deleted_at", null);
if (themeError) throw new Error(themeError.message);
if (!themes?.length) throw new Error("No professional themes seeded.");

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No instructor user.");

const { data: klass } = await admin
  .from("classes")
  .select("id")
  .eq("created_by", userId)
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
if (!klass) throw new Error("No class to verify against.");

const { data: materials } = await admin
  .from("materials")
  .select("id")
  .eq("class_id", klass.id)
  .eq("is_current", true)
  .is("deleted_at", null);
const materialIds = (materials ?? []).map((row) => row.id);
let slideIds = [];
if (materialIds.length) {
  const { data: slides } = await admin
    .from("slides")
    .select("id")
    .in("material_id", materialIds)
    .is("deleted_at", null)
    .order("order");
  slideIds = (slides ?? []).map((row) => row.id);
}

if (slideIds.length < 6) {
  const { data: material } = await admin
    .from("materials")
    .insert({
      class_id: klass.id,
      type: "text",
      original_filename: "phase4-verify.txt",
      storage_path: `classes/${klass.id}/originals/phase4-verify.txt`,
      sha256: `phase4-verify-${Date.now()}`,
      uploaded_by: userId,
      is_current: true,
    })
    .select("id")
    .single();
  if (material.error) throw new Error(material.error.message);
  const extras = Array.from({ length: 6 }, (_, index) => ({
    material_id: material.id,
    order: index + 1,
    title: `Verify slide ${index + 1}`,
    body: "Standard I professionalism.",
    status: "approved",
    layout: "point",
  }));
  const inserted = await admin.from("slides").insert(extras).select("id");
  if (inserted.error) throw new Error(inserted.error.message);
  slideIds = inserted.data.map((row) => row.id);
}

async function createRunAndAssign(excludeIds) {
  const created = await admin
    .from("presentation_runs")
    .insert({
      class_id: klass.id,
      started_by: userId,
      status: "setup",
      settings_json: { theme_mode: "shuffle", use_image_pools: false },
    })
    .select("*")
    .single();
  if (created.error) throw new Error(created.error.message);
  const run = created.data;
  const remaining = themes.filter((theme) => !excludeIds.has(theme.id));
  const deck = shuffle(remaining.length ? remaining : themes);
  const used = [];
  const rows = slideIds.map((slideId, index) => {
    const theme = deck[index % deck.length];
    if (!used.includes(theme.id)) used.push(theme.id);
    return {
      class_id: klass.id,
      slide_id: slideId,
      theme_id: theme.id,
      run_id: run.run_id,
      variation_json: { gradientAngle: (18 + index * 27) % 360, vignette: 0.3 },
    };
  });
  const inserted = await admin.from("theme_assignments").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);
  await admin.from("presentation_runs").update({ theme_ids_used: used }).eq("id", run.id);
  return { run, used, lastFive: rows.slice(-5).map((row) => row.theme_id) };
}

const first = await createRunAndAssign(new Set());
const excluded = new Set(first.lastFive);
const second = await createRunAndAssign(excluded);
const overlap = second.used.filter((id) => excluded.has(id));

const health = await admin.rpc("health_public_table_count");
  const count = health.data;
const { data: live } = await admin.rpc("get_run_by_run_id", { p_run_id: first.run.run_id });

let { data: concept } = await admin
  .from("concepts")
  .select("id, sections!inner(class_id)")
  .eq("sections.class_id", klass.id)
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();
if (!concept) {
  const section = await admin
    .from("sections")
    .insert({ class_id: klass.id, title: "Phase 4 verify", order: 1 })
    .select("id")
    .single();
  if (!section.error) {
    const createdConcept = await admin
      .from("concepts")
      .insert({ section_id: section.data.id, title: "Professionalism", order: 1 })
      .select("id")
      .single();
    concept = createdConcept.data;
  }
}

let poolLock = { created: false, locked: false, unlocked: false };
if (concept?.id) {
  const created = await admin
    .from("image_pools")
    .insert({
      concept_id: concept.id,
      keywords: ["professionalism", "ethics"],
      fallback_query: "professionalism ethics",
      is_locked: true,
      generation_source: "upload",
      last_generated_at: new Date().toISOString(),
    })
    .select("id,is_locked")
    .single();
  if (!created.error) {
    poolLock.created = true;
    poolLock.locked = created.data.is_locked === true;
    const unlocked = await admin
      .from("image_pools")
      .update({ is_locked: false })
      .eq("id", created.data.id)
      .select("is_locked")
      .single();
    poolLock.unlocked = unlocked.data?.is_locked === false;
    await admin
      .from("image_pools")
      .update({ is_locked: true })
      .eq("id", created.data.id);
  }
}

console.log(
  JSON.stringify(
    {
      themes: themes.length,
      slides: slideIds.length,
      first_used: first.used.length,
      first_last_five: first.lastFive,
      second_used: second.used,
      second_avoids_first_last_five: overlap.length === 0,
      health_tables: count,
      get_run_by_run_id_empty_while_setup: Array.isArray(live) ? live.length === 0 : live == null,
      unsplash_key: Boolean(process.env.UNSPLASH_ACCESS_KEY?.trim()),
      image_pool: poolLock,
    },
    null,
    2,
  ),
);
