"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import {
  addQuestionsToPool,
  createPool,
  createPoolWithQuestions,
  getPoolWithQuestions,
  listPools,
  removeQuestionsFromPool,
  reorderPoolQuestions,
  restorePool,
  shufflePoolItems,
  softDeletePool,
  updatePool,
} from "@/lib/data/question-pools";

function refresh(classId: string) {
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/class/${classId}/questions`);
  revalidatePath(`/class/${classId}/questions/pools`);
}

export async function createPoolAction(
  classId: string,
  name: string,
  settings?: { shuffle_on_play?: boolean; time_per_q?: number | null },
) {
  try {
    const pool = await createPool(classId, name.trim() || "Untitled pool", settings);
    refresh(classId);
    return { ok: true as const, pool };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function createPoolWithQuestionsAction(input: {
  classId: string;
  name: string;
  questionIds: string[];
  shuffle_on_play?: boolean;
  time_per_q?: number | null;
}) {
  try {
    const pool = await createPoolWithQuestions(input.classId, input.name, input.questionIds, {
      shuffle_on_play: input.shuffle_on_play,
      time_per_q: input.time_per_q,
    });
    refresh(input.classId);
    return { ok: true as const, pool };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function listPoolsAction(classId: string) {
  try {
    return { ok: true as const, pools: await listPools(classId) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function addToPoolAction(classId: string, poolId: string, questionIds: string[]) {
  try {
    const result = await addQuestionsToPool(poolId, questionIds);
    refresh(classId);
    return { ok: true as const, added: result.added };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function removeFromPoolAction(classId: string, poolId: string, questionIds: string[]) {
  try {
    await removeQuestionsFromPool(poolId, questionIds);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function reorderPoolAction(classId: string, poolId: string, orderedIds: string[]) {
  try {
    await reorderPoolQuestions(poolId, orderedIds);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function getPoolAction(poolId: string) {
  try {
    return { ok: true as const, ...(await getPoolWithQuestions(poolId)) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function updatePoolAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      poolId: z.string().uuid(),
      name: z.string().optional(),
      shuffle_on_play: z.boolean().optional(),
      time_per_q: z.number().int().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid pool" };
  try {
    const { classId, poolId, ...patch } = parsed.data;
    await updatePool(poolId, patch);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function archivePoolAction(classId: string, poolId: string, restore = false) {
  try {
    if (restore) await restorePool(poolId);
    else await softDeletePool(poolId);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function previewPoolAction(poolId: string) {
  try {
    const { pool, items } = await getPoolWithQuestions(poolId);
    return {
      ok: true as const,
      items: pool.shuffle_on_play ? shufflePoolItems(items) : items,
      shuffled: pool.shuffle_on_play,
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
