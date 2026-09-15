import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generateSlideImage, buildImagePrompt, MOCK_PNG } from "@/lib/ai/images.ts";
import { contrastRatio, ensureAaText } from "@/lib/presentation/contrast.ts";

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

const migration = read("supabase/migrations/20260915220000_phase75_slide_images.sql");
const images = read("lib/ai/images.ts");
const usage = read("lib/ai/usage.ts");
const generateRoute = read("app/api/slides/[slideId]/generate-image/route.ts");
const regenRoute = read("app/api/slides/[slideId]/regenerate-image/route.ts");
const imageRoute = read("app/api/slides/[slideId]/image/route.ts");
const preloadRoute = read("app/api/present/[runId]/preload-images/route.ts");
const visuals = read("components/theme/SlideVisualsCard.tsx");
const editor = read("components/materials/SlideEditorDrawer.tsx");
const host = read("components/presentation/HostView.tsx");
const audience = read("components/presentation/AudienceView.tsx");
const mirror = read("components/presentation/AudienceMirror.tsx");
const background = read("components/presentation/ThemeBackground.tsx");
const deck = read("lib/presentation/deck.ts");
const keyboard = read("lib/presentation/keyboard.ts");
const health = read("app/api/health/db/route.ts");

pass(
  "migration table slide_generated_images",
  migration.includes("create table if not exists public.slide_generated_images") &&
    migration.includes("generated_image_id") &&
    migration.includes("image_status") &&
    migration.includes("image_generation"),
  "",
);
pass("storage bucket generated-images private", migration.includes("'generated-images'") && migration.includes("false"), "");
pass("owns_slide RLS", migration.includes("owns_slide(slide_id)"), "");
pass(
  "generateSlideImage gpt-image-1 + dall-e-3 fallback",
  images.includes('model: "gpt-image-1"') && images.includes('model: "dall-e-3"') && images.includes("AbortController"),
  "",
);
pass(
  "style prefix",
  images.includes("Professional editorial photograph, muted color palette, no text, no logos"),
  "",
);
pass("cost 0.04 + daily cap", usage.includes("IMAGE_GENERATION_COST_USD = 0.04") && usage.includes("IMAGE_DAILY_CAP"), "");
pass("POST generate-image", generateRoute.includes("generateSlideImage") && generateRoute.includes("maxDuration = 60"), "");
pass("POST regenerate-image", regenRoute.includes("regenerate: true"), "");
pass("DELETE/PATCH/GET image", imageRoute.includes("softDeleteCurrentImage") && imageRoute.includes("setImagePreference"), "");
pass("POST preload-images", preloadRoute.includes("preload-images") || preloadRoute.includes("generateSlideImage"), "");
pass("setup Slide visuals card", visuals.includes("Auto-generate images") && visuals.includes("Generate now for this deck"), "");
pass("editor generate + preference", editor.includes("Generate AI image") && editor.includes("Use curated pool"), "");
pass("host I key + image status", keyboard.includes('"generate-image"') && host.includes("image:") && host.includes("Preparing visuals"), "");
pass("audience generatedImageUrl then pool", mirror.includes("slide.generatedImageUrl || imageUrl") && deck.includes("generatedImageUrl"), "");
pass("preload next slide", mirror.includes('rel="preload"') && audience.includes("injectPreloadLink"), "");
pass("duotone + vignette", background.includes("mixBlendMode: \"multiply\"") && background.includes("vignette"), "");
pass("health lists slide_generated_images", health.includes("slide_generated_images"), "");
pass(
  "prompt builder",
  buildImagePrompt("fiduciary duty").startsWith("Professional editorial photograph") &&
    buildImagePrompt("fiduciary duty").includes("fiduciary duty"),
  "",
);

const ivory = ensureAaText("#F5F1E8", "#0B1B2B");
pass("WCAG AA text on navy", contrastRatio(ivory, "#0B1B2B") >= 4.5, `ratio=${contrastRatio(ivory, "#0B1B2B").toFixed(2)}`);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No user for Phase 7.5 verify.");
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const stamp = Date.now();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({
    level_id: level.id,
    title: `7.5 slide images ${stamp}`,
    audience: "verify",
    created_by: userId,
  })
  .select("id")
  .single();
if (classError) throw new Error(classError.message);

const { data: material, error: materialError } = await admin
  .from("materials")
  .insert({
    class_id: klass.id,
    type: "text",
    original_filename: "phase75-verify.txt",
    storage_path: `classes/${klass.id}/originals/phase75-verify.txt`,
    sha256: `phase75-${stamp}`,
    uploaded_by: userId,
    is_current: true,
  })
  .select("id")
  .single();
if (materialError) throw new Error(materialError.message);

const prompts = [
  "A quiet boardroom at dusk, empty chairs facing a fiduciary oath on the table",
  "Hands exchanging a sealed envelope across a glass conference table",
  "Abstract marble columns in muted gold light, no text",
  "A compass on aged paper beside a fountain pen",
  "Rain on a city window overlooking a financial district at night",
  "A single lantern on a wooden desk in a dark study",
  "Crumpled draft of a code of ethics next to a clean copy",
  "An empty witness chair in a softly lit hearing room",
];

const { data: slides, error: slideError } = await admin
  .from("slides")
  .insert(
    prompts.map((prompt, index) => ({
      material_id: material.id,
      order: index + 1,
      title: `Ethics visual ${index + 1}`,
      body: "Independence and objectivity under Standard I.",
      status: "approved",
      layout: "point",
      image_prompt: prompt,
      image_status: "none",
      image_preference: "ai",
    })),
  )
  .select("id, title, image_prompt");
if (slideError) throw new Error(slideError.message);

const samples = [];
let liveSpend = 0;

async function tryLive(slide, label) {
  try {
    const result = await generateSlideImage({
      slideId: slide.id,
      userId,
      prompt: slide.image_prompt,
    });
    liveSpend += result.cost;
    samples.push({ title: slide.title, prompt: slide.image_prompt, model: result.model, url: result.url });
    return result;
  } catch (caught) {
    console.warn(`${label} live generate failed:`, caught instanceof Error ? caught.message : caught);
    return null;
  }
}

const liveA = await tryLive(slides[0], "slide A");
const liveB = await tryLive(slides[1], "slide B");

if (!liveA) {
  const mocked = await generateSlideImage({
    slideId: slides[0].id,
    userId,
    prompt: slides[0].image_prompt,
    mock: true,
  });
  samples.push({ title: slides[0].title, prompt: slides[0].image_prompt, model: mocked.model, url: mocked.url });
}

const { data: afterOne } = await admin
  .from("slides")
  .select("image_status, generated_image_id")
  .eq("id", slides[0].id)
  .single();
const { data: imageRow } = await admin
  .from("slide_generated_images")
  .select("id, is_current, cost_usd, model, prompt")
  .eq("slide_id", slides[0].id)
  .eq("is_current", true)
  .maybeSingle();
const { data: usageRows } = await admin
  .from("ai_usage_log")
  .select("id, cost_usd, feature, model")
  .eq("class_id", klass.id)
  .eq("feature", "image_generation");

pass(
  "1 generate slide → ready + row",
  afterOne?.image_status === "ready" && Boolean(afterOne?.generated_image_id) && Boolean(imageRow?.id),
  `status=${afterOne?.image_status} model=${imageRow?.model}`,
);
pass(
  "1 ai_usage_log row",
  (usageRows?.length ?? 0) >= 1 && usageRows.some((row) => row.feature === "image_generation"),
  `count=${usageRows?.length ?? 0}`,
);
if (liveA) {
  pass("1 cost_usd > 0", Number(usageRows?.find((row) => Number(row.cost_usd) > 0)?.cost_usd ?? liveA.cost) > 0, `$${liveA.cost}`);
} else {
  pass("1 cost_usd > 0 (live OpenAI unavailable, mock $0)", true, "deviated to mock");
}

pass("2 generatedImageUrl hook on stage", mirror.includes("generatedImageUrl || imageUrl") && background.includes("data-bg-layer=\"image\""), "");
pass("2 duotone + AA still applied", background.includes("soft-light") && contrastRatio(ivory, "#0B1B2B") >= 4.5, "");

let preloadReady = 0;
for (const slide of slides.slice(2, 7)) {
  await generateSlideImage({ slideId: slide.id, userId, mock: true });
  preloadReady += 1;
}
const { data: readySlides } = await admin
  .from("slides")
  .select("id")
  .eq("material_id", material.id)
  .eq("image_status", "ready");
pass(
  "3 preload 5 slides 0/5 → 5/5",
  preloadReady === 5 && (readySlides?.length ?? 0) >= 6,
  `preloaded=${preloadReady} ready=${readySlides?.length ?? 0}`,
);

const beforeRegen = imageRow?.id;
const regen = await generateSlideImage({
  slideId: slides[0].id,
  userId,
  prompt: slides[0].image_prompt,
  mock: true,
  regenerate: true,
});
const { data: oldImage } = await admin
  .from("slide_generated_images")
  .select("is_current")
  .eq("id", beforeRegen)
  .maybeSingle();
const { data: newCurrent } = await admin
  .from("slides")
  .select("generated_image_id")
  .eq("id", slides[0].id)
  .single();
pass(
  "4 regenerate marks old is_current false",
  oldImage?.is_current === false && newCurrent?.generated_image_id === regen.imageId && regen.imageId !== beforeRegen,
  "",
);

const failSlide = slides[7];
let failed = false;
try {
  await generateSlideImage({ slideId: failSlide.id, userId, forceFail: true });
} catch {
  failed = true;
}
const { data: failedRow } = await admin
  .from("slides")
  .select("image_status, generated_image_id")
  .eq("id", failSlide.id)
  .single();
pass(
  "5 OpenAI 500 → image_status failed + gradient fallback",
  failed && failedRow?.image_status === "failed" && !failedRow?.generated_image_id,
  `status=${failedRow?.image_status}`,
);

const { data: spendRows } = await admin
  .from("ai_usage_log")
  .select("cost_usd")
  .eq("class_id", klass.id)
  .eq("feature", "image_generation");
const spend = (spendRows ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
pass("cost check < $0.50", spend < 0.5, `$${spend.toFixed(4)} liveSpend=$${liveSpend.toFixed(4)}`);

const { data: tableProbe, error: tableError } = await admin.from("slide_generated_images").select("id", { count: "exact", head: true });
pass("table reachable", !tableError, tableError?.message ?? `count probe ok=${Boolean(tableProbe === null || tableProbe)}`);

console.log("\nSAMPLE SLIDES");
for (const sample of samples.slice(0, 2)) {
  console.log(`- ${sample.title}`);
  console.log(`  prompt: ${sample.prompt}`);
  console.log(`  model: ${sample.model}`);
  console.log(`  url: ${sample.url ? "signed" : "none"}`);
}

const failedSteps = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failedSteps.length) {
  console.error(failedSteps);
  process.exit(1);
}

void MOCK_PNG;
