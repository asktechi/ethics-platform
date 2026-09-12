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

const { data: users, error: userError } = await admin.from("users").select("id,email").limit(5);
if (userError) throw new Error(userError.message);
const user = users?.[0];
if (!user) throw new Error("No instructor user");

const { data: klass, error: classError } = await admin
  .from("classes")
  .select("id,title")
  .eq("created_by", user.id)
  .is("deleted_at", null)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (classError) throw new Error(classError.message);
if (!klass) throw new Error("No class");

const { data: materials } = await admin
  .from("materials")
  .select("id")
  .eq("class_id", klass.id)
  .eq("is_current", true)
  .is("deleted_at", null);
const materialIds = (materials ?? []).map((row) => row.id);

let slides = [];
if (materialIds.length) {
  const { data } = await admin
    .from("slides")
    .select("id,title,layout,status,cue")
    .in("material_id", materialIds)
    .is("deleted_at", null)
    .order("order");
  slides = data ?? [];
}

if (slides.length < 8) {
  const created = await admin
    .from("materials")
    .insert({
      class_id: klass.id,
      type: "text",
      original_filename: "phase4b-verify.txt",
      storage_path: `classes/${klass.id}/originals/phase4b-verify.txt`,
      sha256: `phase4b-verify-${Date.now()}`,
      uploaded_by: user.id,
      is_current: true,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  const extras = [
    { layout: "hook", title: "Integrity is not optional", body: "One idea. The room sees it clean." },
    { layout: "point", title: "Standard I lives here", body: "Professionalism is the floor, not the ceiling." },
    { layout: "contrast", title: "Disclose or decline", body: "Full disclosure.\n\nOr walk away." },
    { layout: "scenario", title: "The weekend call", body: "A client asks you to bury a conflict." },
    { layout: "question", title: "Who owns the duty?", body: "The client. The firm. You." },
    { layout: "reveal", title: "The insight", body: "Independence is a practice, not a slogan." },
    { layout: "cue", title: "Breathe", body: "Instructor only", cue: "Ask who has seen a buried conflict. Hold 8 seconds." },
    { layout: "point", title: "Close the loop", body: "Write the standard on the board before you leave." },
  ].map((slide, index) => ({
    material_id: created.data.id,
    order: index + 1,
    title: slide.title,
    body: slide.body,
    cue: slide.cue ?? null,
    status: "approved",
    layout: slide.layout,
  }));
  const inserted = await admin.from("slides").insert(extras).select("id,title,layout,status,cue");
  if (inserted.error) throw new Error(inserted.error.message);
  slides = inserted.data;
} else {
  const cue = slides.find((slide) => slide.layout === "cue");
  if (!cue) {
    await admin.from("slides").update({ layout: "cue", cue: "Hold. Ask the room." }).eq("id", slides[2].id);
    slides[2] = { ...slides[2], layout: "cue", cue: "Hold. Ask the room." };
  }
  await admin.from("slides").update({ status: "approved" }).in("id", slides.map((s) => s.id));
}

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
    started_by: user.id,
    status: "live",
    started_at: new Date().toISOString(),
    settings_json: {
      theme_mode: "shuffle",
      use_image_pools: true,
      teleprompter_wpm: 130,
      allow_audience_advance: false,
      current_slide_index: 0,
    },
  })
  .select("*")
  .single();
if (run.error) throw new Error(run.error.message);

await admin.from("theme_assignments").delete().eq("run_id", run.data.run_id);
const assignments = slides.map((slide, index) => ({
  class_id: klass.id,
  slide_id: slide.id,
  theme_id: themes[index % themes.length].id,
  run_id: run.data.run_id,
  variation_json: { gradientAngle: (18 + index * 27) % 360, vignette: 0.3 },
}));
const assigned = await admin.from("theme_assignments").insert(assignments);
if (assigned.error) throw new Error(assigned.error.message);

console.log(
  JSON.stringify(
    {
      classId: klass.id,
      classTitle: klass.title,
      publicRunId: run.data.run_id,
      runPk: run.data.id,
      slides: slides.length,
      cueSlides: slides.filter((s) => s.layout === "cue").length,
      hostPath: `/class/${klass.id}/present/${run.data.run_id}/host`,
      audiencePath: `/present/${run.data.run_id}/audience`,
      joinPath: `/present/${run.data.run_id}/audience/join`,
      instructorEmail: user.email,
    },
    null,
    2,
  ),
);
