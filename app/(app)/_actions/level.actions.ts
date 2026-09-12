"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLevelBySlug, listLevels } from "@/lib/data/levels";
import { actionError } from "@/lib/data/errors";

const slugSchema = z.object({
  slug: z.string().min(1),
});

export async function refreshLevelsAction() {
  try {
    await listLevels();
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function refreshLevelAction(input: unknown) {
  const parsed = slugSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid slug" };
  }

  try {
    await getLevelBySlug(parsed.data.slug);
    revalidatePath(`/level/${parsed.data.slug}`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
