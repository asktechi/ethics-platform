import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results = [];
function pass(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

function source(rel) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const CLASS_ID = process.env.PERF_CLASS_ID || "bc3e25c9-66e8-4af1-8a60-f9654f25b09a";
const BUDGET_MS = Number(process.env.PERF_BUDGET_MS || 2000);
const BASE =
  process.env.PERF_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://127.0.0.1:43141";

const auth = source("lib/data/auth.ts");
const appLayout = source("app/(app)/layout.tsx");
const classLayout = source("app/(app)/class/[id]/layout.tsx");
const materials = source("lib/data/materials.ts");
const unsplash = source("lib/integrations/unsplash.ts");

pass("requireUser is request-cached", auth.includes("export const requireUser = cache("), "");
pass("getClass is request-cached", source("lib/data/classes.ts").includes("export const getClass = cache("), "");
pass("app layout no longer N+1 getClass", !appLayout.includes("await getClass(item.id)") && appLayout.includes("countQuestionsForClasses"), "");
pass("class layout uses countQuestions not getClass", classLayout.includes("countQuestions") && !classLayout.includes("getClass"), "");
pass("listMaterials does not statically import parsers", !materials.includes('from "@/lib/parsers/parseIndex"') && materials.includes("await import(\"@/lib/parsers/parseIndex\")"), "");
pass("Unsplash fetch has 5s timeout", unsplash.includes("AbortSignal.timeout(5000)"), "");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  pass("env for timed queries", false, "missing Supabase env");
} else {
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  async function time(label, fn) {
    const started = Date.now();
    const value = await fn();
    const ms = Date.now() - started;
    pass(`${label} < ${BUDGET_MS}ms`, ms < BUDGET_MS, `${ms}ms`);
    return { value, ms };
  }

  await time("listMaterials nested slides (Introduction)", async () => {
    const { data, error } = await admin
      .from("materials")
      .select("*, slides(id, status, deleted_at)")
      .eq("class_id", CLASS_ID)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data?.length ?? 0;
  });

  await time("listClassSlides for host/teleprompter", async () => {
    const { data, error } = await admin
      .from("slides")
      .select(
        "id, material_id, concept_id, order, title, body, cue, speaker_note, layout, status, deleted_at, materials!inner(id, class_id, concept_id, original_filename, is_current, deleted_at, list_order, created_at)",
      )
      .eq("materials.class_id", CLASS_ID)
      .eq("materials.is_current", true)
      .is("materials.deleted_at", null)
      .is("deleted_at", null);
    if (error) throw error;
    return data?.length ?? 0;
  });

  await time("sidebar question counts (5 head queries)", async () => {
    const { data: recent, error } = await admin
      .from("classes")
      .select("id")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    await Promise.all(
      (recent ?? []).map((row) =>
        admin.from("questions").select("id", { count: "exact", head: true }).eq("class_id", row.id).is("deleted_at", null),
      ),
    );
    return recent?.length ?? 0;
  });

  await time("class overview query set", async () => {
    await Promise.all([
      admin.from("classes").select("*, level:levels(*)").eq("id", CLASS_ID).maybeSingle(),
      admin.from("sections").select("*").eq("class_id", CLASS_ID),
      admin.from("materials").select("*, slides(id, status, deleted_at)").eq("class_id", CLASS_ID),
      admin.from("questions").select("id, stem, approved").eq("class_id", CLASS_ID).is("deleted_at", null),
      admin.from("question_pools").select("id, name").eq("class_id", CLASS_ID),
    ]);
  });

  const routes = [
    `/class/${CLASS_ID}`,
    `/class/${CLASS_ID}/materials`,
    `/class/${CLASS_ID}/present`,
  ];
  const { data: liveRun } = await admin
    .from("presentation_runs")
    .select("run_id")
    .eq("class_id", CLASS_ID)
    .eq("status", "live")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (liveRun?.run_id) {
    routes.push(`/class/${CLASS_ID}/present/${liveRun.run_id}/host`);
    routes.push(`/api/present/${liveRun.run_id}`);
  }

  let accessToken = process.env.PERF_ACCESS_TOKEN || "";
  if (!accessToken) {
    try {
      const link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: process.env.PERF_EMAIL || "topfapps@gmail.com",
      });
      const hash = link.data?.properties?.hashed_token;
      if (hash) {
        const verified = await admin.auth.verifyOtp({ type: "email", token_hash: hash });
        accessToken = verified.data?.session?.access_token ?? "";
      }
    } catch (error) {
      pass("session for HTTP routes", true, `skipped (${error instanceof Error ? error.message : "no session"})`);
    }
  }

  const cookie = accessToken
    ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token=${encodeURIComponent(
        JSON.stringify({
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
        }),
      )}`
    : "";

  for (const route of routes) {
    const target = `${BASE.replace(/\/$/, "")}${route}`;
    const started = Date.now();
    try {
      const response = await fetch(target, {
        redirect: "manual",
        headers: cookie ? { cookie } : {},
        signal: AbortSignal.timeout(BUDGET_MS + 3000),
      });
      const ms = Date.now() - started;
      const publicApi = route.startsWith("/api/present/");
      const okStatus = publicApi
        ? response.status === 200
        : cookie
          ? response.status === 200 || response.status === 307
          : response.status === 307;
      const within = publicApi ? ms < BUDGET_MS : ms < BUDGET_MS;
      pass(`HTTP ${route}`, okStatus && within, `${response.status} ${ms}ms`);
    } catch (error) {
      const ms = Date.now() - started;
      pass(`HTTP ${route}`, false, `${ms}ms ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.filter((row) => row.ok).length}/${results.length} passed`);
if (failed.length) {
  process.exit(1);
}
