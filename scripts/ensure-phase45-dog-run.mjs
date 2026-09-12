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

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No instructor");

const { data: klass } = await admin
  .from("classes")
  .select("id,title")
  .eq("created_by", userId)
  .is("deleted_at", null)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!klass) throw new Error("No class");

const { data: material, error: materialError } = await admin
  .from("materials")
  .insert({
    class_id: klass.id,
    type: "text",
    original_filename: "phase45-dog.txt",
    storage_path: `classes/${klass.id}/originals/phase45-dog.txt`,
    sha256: `phase45-dog-${Date.now()}`,
    uploaded_by: userId,
    is_current: true,
  })
  .select("id")
  .single();
if (materialError) throw new Error(materialError.message);

const extras = [
  {
    material_id: material.id,
    order: 1,
    title: "The companion",
    body: "The dog is beautiful and smart. It runs quickly across the yard.\nIts loyalty is unwavering.",
    status: "approved",
    layout: "point",
  },
  {
    material_id: material.id,
    order: 2,
    title: "After the yard",
    body: "Then we talk about duty.",
    status: "approved",
    layout: "point",
  },
];
const slides = await admin.from("slides").insert(extras).select("id,title,body");
if (slides.error) throw new Error(slides.error.message);

const { data: themes } = await admin
  .from("themes")
  .select("id")
  .eq("is_professional_locked", true)
  .is("deleted_at", null);
if (!themes?.length) throw new Error("No themes");

await admin
  .from("presentation_runs")
  .update({ status: "ended", ended_at: new Date().toISOString() })
  .eq("class_id", klass.id)
  .eq("status", "live");

const run = await admin
  .from("presentation_runs")
  .insert({
    class_id: klass.id,
    started_by: userId,
    status: "live",
    started_at: new Date().toISOString(),
    settings_json: {
      theme_mode: "shuffle",
      use_image_pools: false,
      teleprompter_wpm: 130,
      audience_reveal_mode: "progressive",
      allow_audience_advance: false,
      current_slide_index: 0,
    },
  })
  .select("*")
  .single();
if (run.error) throw new Error(run.error.message);

const rows = slides.data.map((slide, index) => ({
  class_id: klass.id,
  slide_id: slide.id,
  theme_id: themes[index % themes.length].id,
  run_id: run.data.run_id,
  variation_json: { gradientAngle: 24 + index * 30, vignette: 0.32 },
}));
const assigned = await admin.from("theme_assignments").insert(rows);
if (assigned.error) throw new Error(assigned.error.message);

console.log(
  JSON.stringify(
    {
      classId: klass.id,
      publicRunId: run.data.run_id,
      slides: slides.data.map((s) => ({ title: s.title, body: s.body })),
      audiencePath: `/present/${run.data.run_id}/audience`,
    },
    null,
    2,
  ),
);
