"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getClass } from "@/lib/data/classes";
import { actionError } from "@/lib/data/errors";
import {
  createConcept,
  reorderConcepts,
  restoreConcept,
  softDeleteConcept,
  updateConcept,
} from "@/lib/data/concepts";

const createSchema = z.object({
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  title: z.string().min(1, "Concept title is required").max(160),
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
  sectionId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1),
});

async function revalidateForClass(classId: string) {
  const detail = await getClass(classId);
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/level/${detail.level.slug}`);
}

export async function createConceptAction(input: unknown) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid concept" };
  }

  try {
    await createConcept({
      sectionId: parsed.data.sectionId,
      title: parsed.data.title,
    });
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to add concept") };
  }
}

export async function updateConceptAction(input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid concept" };
  }

  try {
    await updateConcept(parsed.data.id, { title: parsed.data.title });
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to rename concept") };
  }
}

export async function reorderConceptsAction(input: unknown) {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid concept order" };
  }

  try {
    await reorderConcepts(parsed.data.sectionId, parsed.data.orderedIds);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to reorder concepts") };
  }
}

export async function archiveConceptAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid concept" };
  }

  try {
    await softDeleteConcept(parsed.data.id);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to archive concept") };
  }
}

export async function restoreConceptAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid concept" };
  }

  try {
    await restoreConcept(parsed.data.id);
    await revalidateForClass(parsed.data.classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to restore concept") };
  }
}
