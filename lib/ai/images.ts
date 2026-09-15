import "server-only";

import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMAGE_DAILY_CAP,
  IMAGE_GENERATION_COST_USD,
  logAiUsage,
} from "@/lib/ai/usage";
import { signedGeneratedUrl, uploadGeneratedPng } from "@/lib/storage/generated-images";

const STYLE_PREFIX =
  "Professional editorial photograph, muted color palette, no text, no logos, cinematic composition, suitable as a subtle full-bleed background for a slide. Subject: ";

const TIMEOUT_MS = 60_000;

/** 8×8 navy PNG used when ETHICS_IMAGE_MOCK=1 or OpenAI is unavailable in tests. */
export const MOCK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAD0lEQVQoU2NkYGD4z0AEYBxVAABdqgMNqkW0ogAAAABJRU5ErkJggg==",
  "base64",
);

export type ImageStatus = "none" | "queued" | "generating" | "ready" | "failed";
export type ImagePreference = "auto" | "pool" | "ai" | "none";

export type GenerateSlideImageResult = {
  imageId: string;
  storagePath: string;
  url: string;
  cost: number;
  model: string;
};

export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export function buildImagePrompt(subject: string, style?: string) {
  const body = subject.trim() || "abstract professional ethics teaching scene";
  const extra = style?.trim() ? ` ${style.trim()}` : "";
  return `${STYLE_PREFIX}${body}${extra}`;
}

export async function instructorOwnsSlide(userId: string, slideId: string) {
  const admin = createAdminClient();
  const { data: slide, error: slideError } = await admin
    .from("slides")
    .select("id, material_id")
    .eq("id", slideId)
    .maybeSingle();
  if (slideError) throw new Error(slideError.message);
  if (!slide) return { ok: false as const, classId: null as string | null };

  const { data: material, error: materialError } = await admin
    .from("materials")
    .select("class_id")
    .eq("id", slide.material_id)
    .maybeSingle();
  if (materialError) throw new Error(materialError.message);
  if (!material) return { ok: false as const, classId: null as string | null };

  const { data: klass, error: classError } = await admin
    .from("classes")
    .select("created_by")
    .eq("id", material.class_id)
    .maybeSingle();
  if (classError) throw new Error(classError.message);
  if (!klass || klass.created_by !== userId) {
    return { ok: false as const, classId: material.class_id };
  }
  return { ok: true as const, classId: material.class_id };
}

export async function generateSlideImage(input: {
  slideId: string;
  userId: string;
  prompt?: string;
  style?: string;
  aspect?: "landscape";
  regenerate?: boolean;
  forceFail?: boolean;
  mock?: boolean;
}): Promise<GenerateSlideImageResult> {
  const admin = createAdminClient();
  const owned = await instructorOwnsSlide(input.userId, input.slideId);
  if (!owned.ok || !owned.classId) {
    throw new ImageGenerationError("You do not own this slide.");
  }

  const today = await classImageCountToday(owned.classId);
  if (today >= IMAGE_DAILY_CAP) {
    throw new ImageGenerationError(
      `Daily image cap reached (${IMAGE_DAILY_CAP} per class). Disable auto-generation or try tomorrow.`,
    );
  }

  const { data: slide, error: slideError } = await admin
    .from("slides")
    .select("id, title, body, image_prompt, generated_image_id")
    .eq("id", input.slideId)
    .maybeSingle();
  if (slideError || !slide) throw new ImageGenerationError("Slide not found.");

  const subject =
    input.prompt?.trim() ||
    slide.image_prompt?.trim() ||
    [slide.title, slide.body].filter(Boolean).join(". ").slice(0, 400);
  const prompt = buildImagePrompt(subject, input.style);

  await admin
    .from("slides")
    .update({ image_status: "generating", updated_at: new Date().toISOString() })
    .eq("id", input.slideId);

  try {
    if (input.forceFail || process.env.ETHICS_IMAGE_FAIL === "1") {
      throw new ImageGenerationError("OpenAI returned 500");
    }

    const useMock = input.mock === true || process.env.ETHICS_IMAGE_MOCK === "1";
    const generated = useMock
      ? { bytes: MOCK_PNG, model: "mock", width: 8, height: 8 }
      : await callOpenAiImage(prompt);

    const sha = createHash("sha256").update(generated.bytes).digest("hex");
    const storagePath = await uploadGeneratedPng({
      slideId: input.slideId,
      sha256: sha,
      bytes: generated.bytes,
    });

    if (input.regenerate || slide.generated_image_id) {
      await admin
        .from("slide_generated_images")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("slide_id", input.slideId)
        .eq("is_current", true)
        .is("deleted_at", null);
    }

    const cost = generated.model === "mock" ? 0 : IMAGE_GENERATION_COST_USD;
    const { data: row, error: insertError } = await admin
      .from("slide_generated_images")
      .insert({
        slide_id: input.slideId,
        prompt,
        storage_path: storagePath,
        width: generated.width,
        height: generated.height,
        model: generated.model,
        cost_usd: cost,
        is_current: true,
      })
      .select("id")
      .single();
    if (insertError || !row) throw new ImageGenerationError(insertError?.message ?? "Insert failed");

    await admin
      .from("slides")
      .update({
        generated_image_id: row.id,
        image_status: "ready",
        image_prompt: input.prompt?.trim() || slide.image_prompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.slideId);

    await logAiUsage({
      userId: input.userId,
      classId: owned.classId,
      feature: "image_generation",
      model: generated.model,
      costUsd: cost,
    });

    const url = await signedGeneratedUrl(storagePath);
    return { imageId: row.id, storagePath, url, cost, model: generated.model };
  } catch (caught) {
    await admin
      .from("slides")
      .update({ image_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", input.slideId);
    if (caught instanceof ImageGenerationError) throw caught;
    throw new ImageGenerationError(caught instanceof Error ? caught.message : "Image generation failed");
  }
}

export async function softDeleteCurrentImage(slideId: string, userId: string) {
  const owned = await instructorOwnsSlide(userId, slideId);
  if (!owned.ok) throw new ImageGenerationError("You do not own this slide.");
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("slide_generated_images")
    .update({ is_current: false, deleted_at: now, updated_at: now })
    .eq("slide_id", slideId)
    .eq("is_current", true)
    .is("deleted_at", null);
  await admin
    .from("slides")
    .update({
      generated_image_id: null,
      image_status: "none",
      updated_at: now,
    })
    .eq("id", slideId);
}

export async function setImagePreference(slideId: string, userId: string, preference: ImagePreference) {
  const owned = await instructorOwnsSlide(userId, slideId);
  if (!owned.ok) throw new ImageGenerationError("You do not own this slide.");
  const admin = createAdminClient();
  await admin
    .from("slides")
    .update({ image_preference: preference, updated_at: new Date().toISOString() })
    .eq("id", slideId);
}

async function classImageCountToday(classId: string) {
  const admin = createAdminClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await admin
    .from("ai_usage_log")
    .select("id")
    .eq("class_id", classId)
    .eq("feature", "image_generation")
    .gte("created_at", start.toISOString());
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function callOpenAiImage(prompt: string): Promise<{
  bytes: Buffer;
  model: string;
  width: number;
  height: number;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ImageGenerationError("OPENAI_API_KEY is not set.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const primary = await requestImage({
      key,
      prompt,
      model: "gpt-image-1",
      size: "1536x1024",
      signal: controller.signal,
    });
    if (primary) return { ...primary, width: 1536, height: 1024, model: "gpt-image-1" };

    const fallback = await requestImage({
      key,
      prompt,
      model: "dall-e-3",
      size: "1792x1024",
      signal: controller.signal,
      extra: { quality: "standard", response_format: "b64_json" },
    });
    if (fallback) return { ...fallback, width: 1792, height: 1024, model: "dall-e-3" };
    throw new ImageGenerationError("OpenAI image API returned no image.");
  } finally {
    clearTimeout(timer);
  }
}

async function requestImage(options: {
  key: string;
  prompt: string;
  model: string;
  size: string;
  signal: AbortSignal;
  extra?: Record<string, unknown>;
}): Promise<{ bytes: Buffer } | null> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      size: options.size,
      n: 1,
      ...(options.extra ?? {}),
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    if (response.status >= 500) throw new ImageGenerationError(`OpenAI returned ${response.status}`);
    return null;
  }
  const json = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (item?.b64_json) return { bytes: Buffer.from(item.b64_json, "base64") };
  if (item?.url) {
    const download = await fetch(item.url, { signal: options.signal });
    if (!download.ok) return null;
    return { bytes: Buffer.from(await download.arrayBuffer()) };
  }
  return null;
}

export async function listCurrentGeneratedForSlides(slideIds: string[]) {
  if (slideIds.length === 0) return new Map<string, { id: string; storagePath: string }>();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("slide_generated_images")
    .select("id, slide_id, storage_path")
    .in("slide_id", slideIds)
    .eq("is_current", true)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const map = new Map<string, { id: string; storagePath: string }>();
  for (const row of data ?? []) {
    map.set(row.slide_id, { id: row.id, storagePath: row.storage_path });
  }
  return map;
}

export async function signedUrlMap(slideIds: string[]) {
  const current = await listCurrentGeneratedForSlides(slideIds);
  const out = new Map<string, string>();
  await Promise.all(
    [...current.entries()].map(async ([slideId, row]) => {
      try {
        out.set(slideId, await signedGeneratedUrl(row.storagePath));
      } catch {
        /* skip unsigned */
      }
    }),
  );
  return out;
}
