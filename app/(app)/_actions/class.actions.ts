"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createClass,
  getClass,
  restoreClass,
  softDeleteClass,
  updateClass,
} from "@/lib/data/classes";
import { actionError } from "@/lib/data/errors";

const createSchema = z.object({
  levelId: z.string().uuid(),
  levelSlug: z.string().min(1),
  title: z.string().min(1, "Title is required").max(160),
  audience: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160).optional(),
  audience: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

function revalidateClassPaths(levelSlug: string, classId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/level/${levelSlug}`);
  revalidatePath(`/class/${classId}`);
}

export async function createClassAction(input: unknown) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid class" };
  }

  let createdId = "";
  try {
    const created = await createClass({
      levelId: parsed.data.levelId,
      title: parsed.data.title,
      audience: parsed.data.audience,
      description: parsed.data.description,
    });
    createdId = created.id;
    revalidateClassPaths(parsed.data.levelSlug, created.id);
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to create class") };
  }

  redirect(`/class/${createdId}`);
}

export async function updateClassAction(input: unknown) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid class" };
  }

  try {
    const updated = await updateClass(parsed.data.id, {
      title: parsed.data.title,
      audience: parsed.data.audience,
      description: parsed.data.description,
    });
    const detail = await getClass(updated.id);
    revalidateClassPaths(detail.level.slug, updated.id);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to update class") };
  }
}

export async function archiveClassAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid class" };
  }

  try {
    const archived = await softDeleteClass(parsed.data.id);
    const detail = await getClass(archived.id);
    revalidateClassPaths(detail.level.slug, archived.id);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to archive class") };
  }
}

export async function restoreClassAction(input: unknown) {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid class" };
  }

  try {
    const restored = await restoreClass(parsed.data.id);
    const detail = await getClass(restored.id);
    revalidateClassPaths(detail.level.slug, restored.id);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error, "Unable to restore class") };
  }
}

export async function duplicateClassAction() {
  return {
    ok: false as const,
    error: "Duplicate is a stub in Phase 2.",
  };
}
