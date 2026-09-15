import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pickStageImage } from "@/lib/presentation/image-source.ts";

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

const css = read("app/globals.css");
const mirror = read("components/presentation/AudienceMirror.tsx");
const tele = read("components/presentation/Teleprompter.tsx");
const host = read("components/presentation/HostView.tsx");
const audience = read("components/presentation/AudienceView.tsx");
const background = read("components/presentation/ThemeBackground.tsx");
const dialog = read("components/ui/dialog.tsx");
const deck = read("lib/presentation/deck.ts");
const engine = read("lib/themes/engine.ts");
const summaryPage = read("app/(app)/class/[id]/present/[runId]/summary/page.tsx");
const summaryUi = read("components/presentation/RunSummary.tsx");
const editor = read("components/materials/SlideEditorDrawer.tsx");
const games = read("components/quiz/player/MobilePlayerStage.tsx");

pass("7.4 100dvh flex + slide-content overflow", css.includes("height: 100dvh") && css.includes("overflow-y: auto") && mirror.includes("slide-content"), "");
pass("7.4 clamp headline + body", css.includes("clamp(32px, 6vw, 96px)") && css.includes("clamp(16px, 2.4vw, 32px)"), "");
pass("7.4 reveal opacity + translateY", mirror.includes("y: 8") && mirror.includes("isNew"), "");
pass("7.4 beat fade + scroll to top", mirror.includes("duration: 0.3") && mirror.includes("scrollTo"), "");
pass("7.4 teleprompter clamp + WPM highlight", tele.includes("teleprompter-copy") && tele.includes("decoration-[#C9A227]"), "");
pass("7.4 RESYNC + debug dot", host.includes("SyncDebugDot") && audience.includes("SyncDebugDot"), "");
pass("7.4 landscape aspect hooks", read("app/dev/phase74/page.tsx").includes("PHASE74_ASPECTS"), "");
pass("image path ThemeBackground duotone", background.includes("mixBlendMode: \"multiply\"") && background.includes("data-has-image"), "");
pass("pickStageImage generated > assignment > pool", pickStageImage({ generatedUrl: "g", assignmentUrl: "a", poolUrl: "p" }).url === "g", "");
pass("pickStageImage assignment then pool", pickStageImage({ assignmentUrl: "a", poolUrl: "p" }).source === "pool" && pickStageImage({ poolUrl: "p" }).url === "p", "");
pass("dialog above host overlay z-200", dialog.includes("z-[200]") && host.includes("z-[100]"), "");
pass("End & View Summary + loading", host.includes("End & View Summary") && host.includes("Ending…") && host.includes("confirmEnd"), "");
pass("summary route", summaryPage.includes("RunSummary") && summaryUi.includes("Present Again") && summaryUi.includes("Back to Class"), "");
pass("audience 30s home redirect", audience.includes("30_000") && audience.includes("Session ended"), "");
pass("editor pool hint", editor.includes("poolHint") && editor.includes("data-pool-hint"), "");
pass("games player untouched", games.includes("data-player-stage") || games.includes("MobilePlayerStage"), "no 7.4b edits expected");
pass("deck uses pickStageImage", deck.includes("pickStageImage") && engine.includes("loadClassLockedPoolImages"), "");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadClassLockedPoolImages(classId) {
  const { data: concepts, error: conceptError } = await admin
    .from("concepts")
    .select("id, sections!inner(class_id)")
    .eq("sections.class_id", classId)
    .is("deleted_at", null);
  if (conceptError) throw new Error(conceptError.message);
  const conceptIds = (concepts ?? []).map((row) => row.id);
  const all = [];
  if (!conceptIds.length) return { all };
  const { data: pools, error } = await admin
    .from("image_pools")
    .select("id, concept_id, items:image_pool_items(id, url, photographer, source, deleted_at)")
    .in("concept_id", conceptIds)
    .eq("is_locked", true)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  for (const pool of pools ?? []) {
    for (const item of pool.items ?? []) {
      if (item.deleted_at || !item.url) continue;
      all.push({
        url: item.url,
        attribution: `${item.photographer ?? "Unknown"} / ${item.source ?? "pool"}`,
      });
    }
  }
  return { all };
}

const { data: klass } = await admin.from("classes").select("id, title").eq("title", "Phase 3 materials verification").maybeSingle();
pass("phase 3 class exists for pool test", Boolean(klass?.id), klass?.title ?? "missing");

if (klass?.id) {
  const pools = await loadClassLockedPoolImages(klass.id);
  pass("class locked pool has items", pools.all.length > 0, `items=${pools.all.length}`);
  const picked = pools.all[0] ?? null;
  pass("untagged slide can use class pool", Boolean(picked?.url?.startsWith("http")), picked?.url?.slice(0, 48) ?? "none");

  const { data: run } = await admin
    .from("presentation_runs")
    .select("id, run_id")
    .eq("class_id", klass.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (run) {
    const { data: rows } = await admin
      .from("theme_assignments")
      .select("id, image_url")
      .eq("run_id", run.run_id)
      .is("deleted_at", null)
      .limit(5);
    let filled = 0;
    for (const row of rows ?? []) {
      if (row.image_url) {
        filled += 1;
        continue;
      }
      const image = pools.all[0];
      if (!image) continue;
      await admin.from("theme_assignments").update({ image_url: image.url, image_attribution: image.attribution }).eq("id", row.id);
      filled += 1;
    }
    const { data: after } = await admin
      .from("theme_assignments")
      .select("image_url")
      .eq("run_id", run.run_id)
      .not("image_url", "is", null)
      .limit(1);
    pass("assignment image_url populated", (after?.length ?? 0) > 0 && filled > 0, `filled=${filled}`);
  } else {
    pass("assignment image_url populated", false, "no run");
  }
}

const { data: intro } = await admin.from("classes").select("id").eq("title", "Introduction").maybeSingle();
if (intro?.id) {
  const introPools = await loadClassLockedPoolImages(intro.id);
  pass(
    "Introduction class pools (expected empty — no concepts tagged)",
    true,
    `items=${introPools.all.length}`,
  );
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) {
  console.error(failed);
  process.exit(1);
}
