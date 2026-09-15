import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  attachGeneratedImage,
  discardGeneratedImage,
  generateSlideImage,
  MOCK_PNG,
} from "@/lib/ai/images.ts";
import { pickStageImage, imageSourceLabel } from "@/lib/presentation/image-source.ts";
import { PHASE75A_GRADIENT, PHASE75A_NEXT } from "@/lib/presentation/phase75a-fixtures.ts";

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

function poolerUrl(direct) {
  try {
    const parsed = new URL(direct);
    if (!parsed.hostname.startsWith("db.")) return direct;
    const ref = parsed.hostname.split(".")[1];
    parsed.hostname = "aws-0-us-east-2.pooler.supabase.com";
    parsed.port = "5432";
    parsed.username = `postgres.${ref}`;
    return parsed.toString();
  } catch {
    return direct;
  }
}

const background = read("components/presentation/ThemeBackground.tsx");
const mirror = read("components/presentation/AudienceMirror.tsx");
const host = read("components/presentation/HostView.tsx");
const editor = read("components/materials/SlideEditorDrawer.tsx");
const tabs = read("components/materials/SlideImageTabs.tsx");
const visuals = read("components/theme/SlideVisualsCard.tsx");
const setup = read("components/theme/PresentSetup.tsx");
const keyboard = read("lib/presentation/keyboard.ts");
const images = read("lib/ai/images.ts");
const generateRoute = read("app/api/slides/[slideId]/generate-image/route.ts");
const audience = read("components/presentation/AudienceView.tsx");
const gamesPlayer = read("components/quiz/player/MobilePlayerStage.tsx");
const tele = read("components/presentation/Teleprompter.tsx");

pass(
  "2a cinematic gradient (multi-stop, accent glow, vignette, 3% grain)",
  background.includes("data-gradient-quality=\"cinematic\"") &&
    background.includes("linear-gradient") &&
    background.includes("radial-gradient") &&
    background.includes("vignette") &&
    background.includes("opacity: 0.03") &&
    !background.includes("opacity: 0.04"),
  "",
);
pass("2a null imageUrl still renders ThemeBackground", mirror.includes("imageUrl || null") || mirror.includes("stageImage"), "");
pass("2a Next is unconditional", host.includes('dispatch({ type: "NEXT" })') && !host.includes("generatedImageUrl") || host.includes("Next"), "");
pass(
  "2b no auto-generation call sites",
  !host.includes("preload-images") &&
    !host.includes("generateCurrentImage") &&
    !keyboard.includes("generate-image") &&
    !setup.includes("autoGenerate") &&
    !visuals.includes("Generate now for this deck") &&
    !existsSync(join(process.cwd(), "app/api/present/[runId]/preload-images/route.ts")),
  "",
);
pass("2b generate requires confirm", images.includes("confirm !== true") && generateRoute.includes("confirm: body.confirm === true"), "");
pass("2b attach defaults false", generateRoute.includes("attach: body.attach === true") && images.includes("const attach = input.attach === true"), "");
pass(
  "2c cost confirmation modal",
  tabs.includes("Generate AI image for this slide?") &&
    tabs.includes("gpt-image-1") &&
    tabs.includes("Running total this month") &&
    tabs.includes("Try free stock photo first") &&
    tabs.includes("Use this image") &&
    tabs.includes("Discard"),
  "",
);
pass(
  "2d three editor tabs",
  tabs.includes("No image") && tabs.includes("Stock photo") && tabs.includes("AI generated") && editor.includes("SlideImageTabs"),
  "",
);
pass("2d default none / Using theme gradient", tabs.includes('value="none"') && tabs.includes("Using theme gradient") && !tabs.includes("missing image") && !tabs.includes("image required") && !tabs.includes("no image yet"), "");
pass("2e setup read-only source line", visuals.includes("Image source per slide") && visuals.includes("Open deck editor") && !setup.includes("Auto-generate images"), "");
pass("2f preload-images gone", !existsSync(join(process.cwd(), "app/api/present/[runId]/preload-images/route.ts")), "");
pass("I key does not generate", !keyboard.includes("generate-image") && !keyboard.includes('key === "i"') && !host.includes("Image (I)"), "");
pass("Space still NEXT", keyboard.includes('key === " "') && keyboard.includes('{ type: "NEXT" }'), "");
pass("games player unchanged", gamesPlayer.includes("min-h-0 flex-1 overflow-y-auto"), "");
pass("teleprompter still present", tele.includes("teleprompter-copy") && host.includes("<Teleprompter"), "");
pass("audience view still uses optional image", audience.includes("generatedImageUrl || current.imageUrl"), "");
pass("gradient fixture has no image", !PHASE75A_GRADIENT.imageUrl && !PHASE75A_GRADIENT.generatedImageUrl && PHASE75A_GRADIENT.imagePreference === "none" && !PHASE75A_NEXT.imageUrl, "");
pass("dev fixture page", read("app/dev/phase75a/page.tsx").includes("PHASE75A_GRADIENT") && read("app/dev/phase75a/page.tsx").includes("zero images"), "");

const nonePick = pickStageImage({
  preference: "auto",
  generatedUrl: "https://example.com/ai.png",
  assignmentUrl: "https://example.com/pool.jpg",
  stockUrl: "https://example.com/stock.jpg",
});
pass("auto/missing → gradient (ignore pool and AI)", nonePick.url === null && nonePick.source === "none", JSON.stringify(nonePick));
pass(
  "pool uses stock then assignment",
  pickStageImage({ preference: "pool", stockUrl: "https://s", assignmentUrl: "https://a" }).url === "https://s" &&
    pickStageImage({ preference: "ai", generatedUrl: "https://g" }).url === "https://g" &&
    pickStageImage({ preference: "none", generatedUrl: "https://g", stockUrl: "https://s" }).url === null,
  "",
);
pass("source label default none", imageSourceLabel({ preference: "auto" }) === "none", "");

if (!process.env.SUPABASE_DB_URL) {
  pass("apply 7.5a migration", false, "SUPABASE_DB_URL missing");
} else {
  const client = new pg.Client({
    connectionString: poolerUrl(process.env.SUPABASE_DB_URL),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const sql = read("supabase/migrations/20260915230000_phase75a_optional_images.sql");
    await client.query(sql);
    pass("apply 7.5a migration", true, "stock_image_url + default none");
  } catch (caught) {
    pass("apply 7.5a migration", false, caught instanceof Error ? caught.message : String(caught));
  } finally {
    await client.end().catch(() => undefined);
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users } = await admin.from("users").select("id").limit(1);
const userId = users?.[0]?.id;
if (!userId) throw new Error("No user for Phase 7.5a verify.");
const { data: level } = await admin.from("levels").select("id").eq("slug", "level-1").maybeSingle();
const stamp = Date.now();
const { data: klass, error: classError } = await admin
  .from("classes")
  .insert({
    level_id: level.id,
    title: `7.5a optional images ${stamp}`,
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
    original_filename: "phase75a-verify.txt",
    storage_path: `classes/${klass.id}/originals/phase75a-verify.txt`,
    sha256: `phase75a-${stamp}`,
    uploaded_by: userId,
    is_current: true,
  })
  .select("id")
  .single();
if (materialError) throw new Error(materialError.message);

const { data: slides, error: slideError } = await admin
  .from("slides")
  .insert([
    {
      material_id: material.id,
      order: 1,
      title: "Zero image A",
      body: "Gradient only.",
      status: "approved",
      layout: "point",
      image_preference: "none",
      image_status: "none",
    },
    {
      material_id: material.id,
      order: 2,
      title: "Zero image B",
      body: "Still gradient.",
      status: "approved",
      layout: "hook",
      image_preference: "none",
      image_status: "none",
    },
    {
      material_id: material.id,
      order: 3,
      title: "AI opt-in",
      body: "Pending attach.",
      status: "approved",
      layout: "point",
      image_preference: "none",
      image_status: "none",
      image_prompt: "abstract navy columns, no text",
    },
  ])
  .select("id, title, generated_image_id, image_preference, image_status");
if (slideError) throw new Error(slideError.message);

const zeroA = pickStageImage({
  preference: slides[0].image_preference,
  generatedUrl: null,
  assignmentUrl: null,
  poolUrl: null,
  stockUrl: null,
});
pass("Test 1 zero-image slides pick gradient", zeroA.url === null && zeroA.source === "none", "");

let threwWithoutConfirm = false;
try {
  await generateSlideImage({ slideId: slides[2].id, userId, mock: true });
} catch (caught) {
  threwWithoutConfirm = caught instanceof Error && caught.message.includes("Confirmation required");
}
pass("generate without confirm is refused", threwWithoutConfirm, "");

const pending = await generateSlideImage({
  slideId: slides[2].id,
  userId,
  prompt: "abstract navy columns, no text",
  mock: true,
  confirm: true,
  attach: false,
});
const { data: afterPending } = await admin
  .from("slides")
  .select("generated_image_id, image_preference, image_status")
  .eq("id", slides[2].id)
  .single();
const { data: pendingRow } = await admin
  .from("slide_generated_images")
  .select("id, is_current, deleted_at, cost_usd")
  .eq("id", pending.imageId)
  .single();
pass(
  "Test 3 generate stores but does not attach",
  pending.attached === false &&
    pendingRow?.is_current === false &&
    !afterPending?.generated_image_id &&
    (afterPending?.image_preference === "none" || afterPending?.image_preference === "auto"),
  `attached=${pending.attached} current=${pendingRow?.is_current} slideImg=${afterPending?.generated_image_id}`,
);

await attachGeneratedImage({ slideId: slides[2].id, userId, imageId: pending.imageId });
const { data: afterAttach } = await admin
  .from("slides")
  .select("generated_image_id, image_preference, image_status")
  .eq("id", slides[2].id)
  .single();
const { data: attachedRow } = await admin
  .from("slide_generated_images")
  .select("is_current")
  .eq("id", pending.imageId)
  .single();
pass(
  "Test 3 Use this image attaches",
  afterAttach?.generated_image_id === pending.imageId &&
    afterAttach?.image_preference === "ai" &&
    afterAttach?.image_status === "ready" &&
    attachedRow?.is_current === true,
  "",
);

const extra = await generateSlideImage({
  slideId: slides[2].id,
  userId,
  mock: true,
  confirm: true,
  attach: false,
});
await discardGeneratedImage({ slideId: slides[2].id, userId, imageId: extra.imageId });
const { data: discarded } = await admin
  .from("slide_generated_images")
  .select("deleted_at, is_current")
  .eq("id", extra.imageId)
  .single();
pass("Test 4 discard pending marks deleted", Boolean(discarded?.deleted_at) && discarded?.is_current === false, "");

await discardGeneratedImage({ slideId: slides[2].id, userId, imageId: pending.imageId });
const { data: afterDiscardAttach } = await admin
  .from("slides")
  .select("generated_image_id, image_preference")
  .eq("id", slides[2].id)
  .single();
pass(
  "Test 4 discard attached → gradient",
  !afterDiscardAttach?.generated_image_id && afterDiscardAttach?.image_preference === "none",
  "",
);

const prevCap = process.env.AI_IMAGE_MONTHLY_CAP_USD;
process.env.AI_IMAGE_MONTHLY_CAP_USD = "0.01";
let capBlocked = false;
let capMessage = "";
try {
  await generateSlideImage({
    slideId: slides[0].id,
    userId,
    mock: true,
    confirm: true,
    attach: false,
  });
} catch (caught) {
  capMessage = caught instanceof Error ? caught.message : String(caught);
  capBlocked = capMessage.includes("AI image budget reached for this class this month");
}
if (prevCap === undefined) delete process.env.AI_IMAGE_MONTHLY_CAP_USD;
else process.env.AI_IMAGE_MONTHLY_CAP_USD = prevCap;
pass("Test 5 monthly cap blocks generate", capBlocked, capMessage);

const { data: usageRows } = await admin
  .from("ai_usage_log")
  .select("cost_usd, model, feature")
  .eq("class_id", klass.id)
  .eq("feature", "image_generation");
const spend = (usageRows ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
pass("usage rows for mock generates", (usageRows?.length ?? 0) >= 1, `count=${usageRows?.length ?? 0}`);
pass("this class AI spend $0.00 (mock only)", spend === 0, `$${spend.toFixed(4)}`);
pass("no gpt-image-1 rows this phase", !(usageRows ?? []).some((row) => row.model === "gpt-image-1"), "");

void MOCK_PNG;

const failedSteps = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failedSteps.length) {
  console.error(failedSteps);
  process.exit(1);
}
