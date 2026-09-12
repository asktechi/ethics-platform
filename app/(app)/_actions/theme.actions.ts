"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import { requireUser } from "@/lib/data/auth";
import { listConceptsByClass } from "@/lib/data/concepts";
import { clearPool, createOrReplacePool, listPoolsForClass, regeneratePool } from "@/lib/data/image-pools";
import { getOrCreateRun } from "@/lib/data/presentation-runs";
import { MissingApiKeyError, hasUnsplashKey, searchImages } from "@/lib/integrations/unsplash";
import {
  assignThemeForRun,
  getAssignmentsForRun,
  getThemeReel,
  listClassSlides,
  pinThemeToSlide,
  reshuffleRun,
} from "@/lib/themes/engine";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidateTheme(classId: string) {
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/class/${classId}/theme`);
  revalidatePath(`/class/${classId}/present`);
}

export async function loadThemeStudioAction(input: unknown) {
  const parsed = z.object({ classId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid class" };
  try {
    const { user } = await requireUser();
    const run = await getOrCreateRun(parsed.data.classId, user.id);
    const existing = await getAssignmentsForRun(run.id);
    const reel = existing.length
      ? await (async () => {
          const slides = await listClassSlides(parsed.data.classId);
          const byId = new Map(slides.map((slide) => [slide.id, slide]));
          return existing.map((row) => {
            const slide = byId.get(row.slide_id);
            return {
              slide_id: row.slide_id,
              title: slide?.title ?? "Untitled slide",
              body: slide?.body ?? "",
              status: slide?.status ?? "draft",
              theme_id: "",
              theme_name: row.theme_json.name ?? "Theme",
              theme_json: row.theme_json,
              image_url: row.image_url,
              image_attribution: row.image_attribution,
              override: false,
            };
          });
        })()
      : await assignThemeForRun(run.id);
    const admin = createAdminClient();
    const [{ data: themes }, concepts, pools] = await Promise.all([
      admin
        .from("themes")
        .select("id, name, palette_json")
        .eq("is_professional_locked", true)
        .is("deleted_at", null)
        .order("name"),
      listConceptsByClass(parsed.data.classId, { includeArchived: false }),
      listPoolsForClass(parsed.data.classId),
    ]);
    return {
      ok: true as const,
      run,
      reel,
      themes: themes ?? [],
      concepts,
      pools,
      unsplashConfigured: hasUnsplashKey(),
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reshuffleAction(input: unknown) {
  const parsed = z
    .object({ classId: z.string().uuid(), runId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid run" };
  try {
    const reel = await reshuffleRun(parsed.data.runId);
    revalidateTheme(parsed.data.classId);
    return { ok: true as const, reel };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function previewReelAction(input: unknown) {
  const parsed = z.object({ classId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid class" };
  try {
    const reel = await getThemeReel(parsed.data.classId);
    return { ok: true as const, reel };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function pinThemeAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      runId: z.string().uuid(),
      slideId: z.string().uuid(),
      themeId: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid pin" };
  try {
    await pinThemeToSlide(parsed.data.runId, parsed.data.slideId, parsed.data.themeId);
    revalidateTheme(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function searchUnsplashAction(input: unknown) {
  const parsed = z
    .object({ query: z.string().min(1).max(160), count: z.number().int().min(1).max(30).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid query" };
  try {
    const images = await searchImages(parsed.data.query, {
      count: parsed.data.count ?? 24,
      orientation: "landscape",
    });
    return { ok: true as const, images };
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { ok: false as const, error: error.message, missingKey: true as const };
    }
    return { ok: false as const, error: actionError(error) };
  }
}

export async function lockImagePoolAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      conceptId: z.string().uuid(),
      keywords: z.array(z.string()).max(12),
      images: z.array(
        z.object({
          id: z.string(),
          url: z.string().url(),
          thumb_url: z.string(),
          photographer: z.string(),
          source_url: z.string(),
        }),
      ),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid pool" };
  try {
    const pool = await createOrReplacePool(
      parsed.data.conceptId,
      parsed.data.keywords,
      parsed.data.images,
    );
    revalidateTheme(parsed.data.classId);
    return { ok: true as const, pool };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function regeneratePoolAction(input: unknown) {
  const parsed = z
    .object({
      conceptId: z.string().uuid(),
      keywords: z.array(z.string()).max(12),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid regenerate" };
  try {
    const images = await regeneratePool(parsed.data.conceptId, parsed.data.keywords);
    return { ok: true as const, images };
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { ok: false as const, error: error.message, missingKey: true as const };
    }
    return { ok: false as const, error: actionError(error) };
  }
}

export async function clearPoolAction(input: unknown) {
  const parsed = z
    .object({ classId: z.string().uuid(), poolId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid pool" };
  try {
    await clearPool(parsed.data.poolId);
    revalidateTheme(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
