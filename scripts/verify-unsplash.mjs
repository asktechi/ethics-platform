import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index < 0) continue;
  process.env[trimmed.slice(0, index).trim()] ||= trimmed.slice(index + 1).trim();
}

const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
if (!key) {
  console.log(JSON.stringify({ ok: false, missingKey: true }));
  process.exit(0);
}

const params = new URLSearchParams({
  query: "professionalism ethics",
  per_page: "24",
  orientation: "landscape",
});
const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
  headers: {
    Authorization: `Client-ID ${key}`,
    "Accept-Version": "v1",
  },
});
const payload = await response.json();
const photos = (payload.results ?? []).map((photo) => ({
  id: photo.id,
  photographer: photo.user?.name ?? null,
}));

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pool = { locked: false, item_count: 0, unlocked: false };
const { data: concept } = await admin
  .from("concepts")
  .select("id")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (concept && photos.length) {
  const created = await admin
    .from("image_pools")
    .insert({
      concept_id: concept.id,
      keywords: ["professionalism", "ethics"],
      fallback_query: "professionalism ethics",
      is_locked: true,
      generation_source: "unsplash",
      last_generated_at: new Date().toISOString(),
    })
    .select("id,is_locked")
    .single();
  if (!created.error) {
    const first = payload.results[0];
    await admin.from("image_pool_items").insert({
      image_pool_id: created.data.id,
      url: first.urls?.regular ?? "https://images.unsplash.com",
      thumb_url: first.urls?.small ?? first.urls?.thumb,
      source: "unsplash",
      photographer: first.user?.name,
      source_url: first.links?.html,
      order: 1,
    });
    const { count } = await admin
      .from("image_pool_items")
      .select("id", { count: "exact", head: true })
      .eq("image_pool_id", created.data.id)
      .is("deleted_at", null);
    pool.locked = created.data.is_locked === true;
    pool.item_count = count ?? 0;
    const unlocked = await admin
      .from("image_pools")
      .update({ is_locked: false })
      .eq("id", created.data.id)
      .select("is_locked")
      .single();
    pool.unlocked = unlocked.data?.is_locked === false;
    await admin.from("image_pools").update({ is_locked: true }).eq("id", created.data.id);
  }
}

console.log(
  JSON.stringify(
    {
      status: response.status,
      count: photos.length,
      photographers: [...new Set(photos.map((photo) => photo.photographer))],
      pool,
    },
    null,
    2,
  ),
);
