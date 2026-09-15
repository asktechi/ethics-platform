"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import {
  approveAllSlides,
  getMaterial,
  getSignedOriginal,
  listMaterials,
  reextractMaterial,
  renameMaterial,
  reorderMaterials,
  reorderSlides,
  restoreMaterial,
  setCurrentVersion,
  softDeleteMaterial,
  updateSlide,
} from "@/lib/data/materials";

const idSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
});

function revalidateClass(classId: string) {
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/class/${classId}/materials`);
}

export async function updateSlideAction(input: unknown) {
  const parsed = z
    .object({
      slideId: z.string().uuid(),
      classId: z.string().uuid(),
      title: z.string().optional(),
      body: z.string().optional(),
      cue: z.string().optional(),
      speaker_note: z.string().optional(),
      layout: z
        .enum(["hook", "point", "contrast", "scenario", "question", "reveal", "cue"])
        .optional(),
      image_prompt: z.string().optional(),
      image_preference: z.enum(["auto", "pool", "ai", "none"]).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid slide" };
  try {
    const { slideId, classId: _classId, ...patch } = parsed.data;
    void _classId;
    await updateSlide(slideId, patch);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reorderSlidesAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      materialId: z.string().uuid(),
      orderedIds: z.array(z.string().uuid()).min(1),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid order" };
  try {
    await reorderSlides(parsed.data.materialId, parsed.data.orderedIds);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function approveAllSlidesAction(input: unknown) {
  const parsed = z
    .object({ materialId: z.string().uuid(), classId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    await approveAllSlides(parsed.data.materialId);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function archiveMaterialAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    await softDeleteMaterial(parsed.data.id);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function restoreMaterialAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    await restoreMaterial(parsed.data.id);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function renameMaterialAction(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      classId: z.string().uuid(),
      filename: z.string().min(1).max(240),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid name" };
  try {
    await renameMaterial(parsed.data.id, parsed.data.filename);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reextractMaterialAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    const result = await reextractMaterial(parsed.data.id);
    revalidateClass(parsed.data.classId);
    return { ok: true as const, ...result };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function setCurrentVersionAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    await setCurrentVersion(parsed.data.id);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function listMaterialsAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      includeArchived: z.boolean().optional(),
      sort: z.enum(["uploaded", "manual"]).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid class" };
  try {
    const materials = await listMaterials(parsed.data.classId, {
      includeArchived: parsed.data.includeArchived,
      sort: parsed.data.sort,
    });
    return { ok: true as const, materials };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function getMaterialAction(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    const material = await getMaterial(parsed.data.id);
    return { ok: true as const, material };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reorderMaterialsAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      orderedIds: z.array(z.string().uuid()).min(1),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid order" };
  try {
    await reorderMaterials(parsed.data.classId, parsed.data.orderedIds);
    revalidateClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function downloadOriginalAction(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid material" };
  try {
    const url = await getSignedOriginal(parsed.data.id);
    return { ok: true as const, url };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
