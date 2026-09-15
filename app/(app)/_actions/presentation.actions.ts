"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import { requireUser } from "@/lib/data/auth";
import { approveAllSlidesForClass } from "@/lib/data/materials";
import {
  endRun,
  getOrCreateRun,
  startRun,
  syncRunProgress,
  updateRunSettings,
} from "@/lib/data/presentation-runs";
import { classAiSpend, classImageSpendToday, IMAGE_GENERATION_COST_USD } from "@/lib/ai/usage";
import { signedUrlMap } from "@/lib/ai/images";
import { loadApprovedDeck } from "@/lib/presentation/deck";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assignThemeForRun,
  fillMissingAssignmentImages,
  getAssignmentsForRun,
  listClassSlides,
  reshuffleRun,
} from "@/lib/themes/engine";
import { DEFAULT_RUN_SETTINGS, parseRunSettings, type RunSettings } from "@/lib/themes/types";

function revalidatePresent(classId: string) {
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/class/${classId}/present`);
  revalidatePath(`/class/${classId}/theme`);
}

export async function loadPresentSetupAction(input: unknown) {
  const parsed = z.object({ classId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid class" };
  try {
    const { user } = await requireUser();
    const run = await getOrCreateRun(parsed.data.classId, user.id);
    const slides = await listClassSlides(parsed.data.classId);
    let assignments = await getAssignmentsForRun(run.id);
    if (assignments.length === 0 && slides.length) {
      const reel = await assignThemeForRun(run.id);
      assignments = reel.map((item) => ({
        slide_id: item.slide_id,
        theme_json: item.theme_json,
        image_url: item.image_url,
        image_attribution: item.image_attribution,
      }));
    }
    const admin = createAdminClient();
    const [themesResult, spend, today, imageUrls] = await Promise.all([
      admin
        .from("themes")
        .select("id, name, palette_json")
        .eq("is_professional_locked", true)
        .is("deleted_at", null)
        .order("name"),
      classAiSpend(parsed.data.classId),
      classImageSpendToday(parsed.data.classId),
      signedUrlMap(slides.map((slide) => slide.id)),
    ]);
    return {
      ok: true as const,
      run,
      settings: parseRunSettings(run.settings_json),
      slides,
      assignments,
      themes: themesResult.data ?? [],
      spend,
      imageToday: today,
      imageCostEach: IMAGE_GENERATION_COST_USD,
      imageUrls: Object.fromEntries(imageUrls),
      counts: {
        total: slides.length,
        approved: slides.filter((slide) => slide.status === "approved").length,
        draft: slides.filter((slide) => slide.status === "draft").length,
      },
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function saveRunSettingsAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      runId: z.string().uuid(),
      settings: z.object({
        seconds_per_slide: z.number().int().min(0).max(600),
        teleprompter_wpm: z.number().int().min(60).max(400),
        use_image_pools: z.boolean(),
        theme_mode: z.enum(["shuffle", "locked"]),
        locked_theme_id: z.string().uuid().nullable().optional(),
        theme_overrides: z.record(z.string(), z.string()).optional(),
        allow_audience_advance: z.boolean().optional(),
        audience_reveal_mode: z.enum(["progressive", "instant"]).optional(),
        auto_generate_images: z.boolean().optional(),
      }),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid settings" };
  try {
    const current = parseRunSettings(
      (await (await import("@/lib/data/presentation-runs")).getRunByPk(parsed.data.runId))
        .settings_json,
    );
    const settings: RunSettings = {
      ...DEFAULT_RUN_SETTINGS,
      ...current,
      ...parsed.data.settings,
      theme_overrides: parsed.data.settings.theme_overrides ?? current.theme_overrides,
      allow_audience_advance:
        parsed.data.settings.allow_audience_advance ?? current.allow_audience_advance,
      audience_reveal_mode:
        parsed.data.settings.audience_reveal_mode ?? current.audience_reveal_mode,
      auto_generate_images:
        parsed.data.settings.auto_generate_images ?? current.auto_generate_images,
    };
    await updateRunSettings(parsed.data.runId, settings);
    revalidatePresent(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function approveAllClassSlidesAction(input: unknown) {
  const parsed = z.object({ classId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid class" };
  try {
    const count = await approveAllSlidesForClass(parsed.data.classId);
    revalidatePresent(parsed.data.classId);
    return { ok: true as const, count };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function startPresentationAction(input: unknown) {
  const parsed = z
    .object({ classId: z.string().uuid(), runId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid run" };
  try {
    const assignments = await getAssignmentsForRun(parsed.data.runId);
    if (assignments.length === 0) {
      await assignThemeForRun(parsed.data.runId);
    }
    await fillMissingAssignmentImages(parsed.data.runId);
    const run = await startRun(parsed.data.runId);
    revalidatePresent(parsed.data.classId);
    return { ok: true as const, publicRunId: run.run_id };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function syncRunProgressAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      runId: z.string().uuid(),
      slideIndex: z.number().int().min(0),
      slidesAdvanced: z.number().int().min(0).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid progress" };
  try {
    await syncRunProgress(parsed.data.runId, {
      current_slide_index: parsed.data.slideIndex,
      slides_advanced: parsed.data.slidesAdvanced,
    });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function endPresentationAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      runId: z.string().uuid(),
      peakAudience: z.number().int().min(0).optional(),
      slidesAdvanced: z.number().int().min(0).optional(),
      slideIndex: z.number().int().min(0).optional(),
      slideSeconds: z.array(z.number().min(0)).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid run" };
  try {
    await endRun(parsed.data.runId, {
      peak_audience: parsed.data.peakAudience,
      slides_advanced: parsed.data.slidesAdvanced,
      current_slide_index: parsed.data.slideIndex,
      slide_seconds: parsed.data.slideSeconds,
    });
    revalidatePresent(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reshuffleLiveRunAction(input: unknown) {
  const parsed = z
    .object({ classId: z.string().uuid(), runId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid run" };
  try {
    const { getRunByPk } = await import("@/lib/data/presentation-runs");
    const run = await getRunByPk(parsed.data.runId);
    await reshuffleRun(run.id);
    const slides = await loadApprovedDeck(run.class_id, run.run_id, {
      includeInstructorFields: true,
    });
    revalidatePresent(parsed.data.classId);
    return { ok: true as const, slides };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
