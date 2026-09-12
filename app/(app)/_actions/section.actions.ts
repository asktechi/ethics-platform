"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getClass } from "@/lib/data/classes";
import { actionError } from "@/lib/data/errors";
import {
  createSection,
  reorderSections,
  restoreSection,
  softDeleteSection,
  updateSection,
} from "@/lib/data/sections";

const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1, "Section title is required").max(160),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string().min(1).max(160),
});

const idSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
});

const reorderSchema = z.object({
  classId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

async function revalidateForClass(classId: string) {
  const detail = await getClass(classId);
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/level/${detail.level.slug}`);
}

export async function createSectionAction(input: unknown) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid section" };
  }

  try {
    await createSection({
      classId: parsed.data.classId,
      title: parsed.data.title,
    });
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to add section") };
  }
}

export async function updateSectionAction(input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid section" };
  }

  try {
    await updateSection(parsed.data.id, { title: parsed.data.title });
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to rename section") };
  }
}

export async function reorderSectionsAction(input: unknown) {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid section order" };
  }

  try {
    await reorderSections(parsed.data.classId, parsed.data.orderedIds);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to reorder sections") };
  }
}

export async function archiveSectionAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid section" };
  }

  try {
    await softDeleteSection(parsed.data.id);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to archive section") };
  }
}

export async function restoreSectionAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid section" };
  }

  try {
    await restoreSection(parsed.data.id);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to restore section") };
  }
}
