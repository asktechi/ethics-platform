import "server-only";
import { requireUser } from "@/lib/data/auth";
import { requireValue } from "@/lib/data/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchImages, type UnsplashImage } from "@/lib/integrations/unsplash";
import type { ImagePool, ImagePoolItem } from "@/types/db.helpers";
import type { ImagePoolWithItems } from "@/lib/data/image-pools.types";

export type { ImagePoolWithItems } from "@/lib/data/image-pools.types";

export async function getPoolForConcept(conceptId: string): Promise<ImagePoolWithItems | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("image_pools")
    .select("*, items:image_pool_items(*)")
    .eq("concept_id", conceptId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ImagePool & { items?: ImagePoolItem[] };
  return {
    ...row,
    items: (row.items ?? [])
      .filter((item) => !item.deleted_at)
      .sort((a, b) => a.order - b.order),
  };
}

export async function listPoolsForClass(classId: string): Promise<ImagePoolWithItems[]> {
  const { supabase } = await requireUser();
  const { data: concepts, error: conceptError } = await supabase
    .from("concepts")
    .select("id, sections!inner(class_id)")
    .eq("sections.class_id", classId)
    .is("deleted_at", null);
  if (conceptError) throw new Error(conceptError.message);
  const ids = (concepts ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("image_pools")
    .select("*, items:image_pool_items(*)")
    .in("concept_id", ids)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<ImagePool & { items?: ImagePoolItem[] }>).map((row) => ({
    ...row,
    items: (row.items ?? [])
      .filter((item) => !item.deleted_at)
      .sort((a, b) => a.order - b.order),
  }));
}

export async function createOrReplacePool(
  conceptId: string,
  keywords: string[],
  images: UnsplashImage[],
): Promise<ImagePoolWithItems> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const existing = await getPoolForConcept(conceptId);

  let poolId = existing?.id;
  if (!poolId) {
    const { data, error } = await admin
      .from("image_pools")
      .insert({
        concept_id: conceptId,
        keywords,
        fallback_query: keywords.join(" "),
        is_locked: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        generation_source: "unsplash",
        last_generated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    poolId = data.id;
  } else {
    const { error } = await admin
      .from("image_pools")
      .update({
        keywords,
        fallback_query: keywords.join(" "),
        is_locked: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        generation_source: "unsplash",
        last_generated_at: new Date().toISOString(),
        deleted_at: null,
      })
      .eq("id", poolId);
    if (error) throw new Error(error.message);
    await admin
      .from("image_pool_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("image_pool_id", poolId)
      .is("deleted_at", null);
  }

  if (images.length) {
    const { error } = await admin.from("image_pool_items").insert(
      images.map((image, index) => ({
        image_pool_id: poolId,
        url: image.url,
        thumb_url: image.thumb_url,
        source: "unsplash",
        photographer: image.photographer,
        source_url: image.source_url,
        order: index + 1,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return requireValue(await getPoolForConcept(conceptId), "Pool was not saved.");
}

export async function regeneratePool(conceptId: string, keywords: string[]): Promise<UnsplashImage[]> {
  const query = keywords.filter(Boolean).join(" ").trim() || "professional ethics";
  const images = await searchImages(query, { count: 24, orientation: "landscape" });
  const admin = createAdminClient();
  const existing = await getPoolForConcept(conceptId);
  if (existing) {
    await admin
      .from("image_pools")
      .update({
        keywords,
        fallback_query: query,
        last_generated_at: new Date().toISOString(),
        generation_source: "unsplash",
      })
      .eq("id", existing.id);
  }
  return images;
}

export async function lockPool(poolId: string): Promise<ImagePool> {
  const { user, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("image_pools")
    .update({
      is_locked: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", poolId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ImagePool;
}

export async function unlockPool(poolId: string): Promise<ImagePool> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("image_pools")
    .update({ is_locked: false })
    .eq("id", poolId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ImagePool;
}

export async function deletePoolItem(itemId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("image_pool_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function clearPool(poolId: string): Promise<void> {
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  const items = await supabase
    .from("image_pool_items")
    .update({ deleted_at: now })
    .eq("image_pool_id", poolId)
    .is("deleted_at", null);
  if (items.error) throw new Error(items.error.message);
  const { error } = await supabase
    .from("image_pools")
    .update({ is_locked: false, approved_at: null, generation_source: "none" })
    .eq("id", poolId);
  if (error) throw new Error(error.message);
}
