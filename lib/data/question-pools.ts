import { requireUser } from "@/lib/data/auth";
import type { QuestionRow } from "@/lib/data/questions";

export type PoolRow = {
  id: string;
  class_id: string;
  name: string;
  shuffle_on_play: boolean;
  time_per_q: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PoolItem = {
  id: string;
  question_id: string;
  order: number;
  question: QuestionRow;
};

export type PoolWithQuestions = {
  pool: PoolRow;
  items: PoolItem[];
};

export async function listPools(classId: string, includeArchived = false): Promise<PoolRow[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("question_pools")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (!includeArchived) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PoolRow[];
}

export async function createPool(
  classId: string,
  name: string,
  settings?: { shuffle_on_play?: boolean; time_per_q?: number | null },
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("question_pools")
    .insert({
      class_id: classId,
      name,
      shuffle_on_play: settings?.shuffle_on_play ?? true,
      time_per_q: settings?.time_per_q ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePool(
  poolId: string,
  patch: { name?: string; shuffle_on_play?: boolean; time_per_q?: number | null },
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("question_pools")
    .update(patch)
    .eq("id", poolId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function addQuestionsToPoolFallback(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  poolId: string,
  unique: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("question_pool_items")
    .select("question_id, order, deleted_at")
    .eq("pool_id", poolId);
  if (existingError) throw new Error(existingError.message);
  const active = new Set((existing ?? []).filter((row) => !row.deleted_at).map((row) => row.question_id));
  const start = (existing ?? []).reduce((max, row) => Math.max(max, row.order ?? 0), -1) + 1;
  const fresh = unique.filter((id) => !active.has(id) && !(existing ?? []).some((row) => row.question_id === id));
  const restore = unique.filter((id) => (existing ?? []).some((row) => row.question_id === id && row.deleted_at));
  if (restore.length) {
    await supabase.from("question_pool_items").update({ deleted_at: null }).eq("pool_id", poolId).in("question_id", restore);
  }
  const rows = fresh.map((question_id, index) => ({
    pool_id: poolId,
    question_id,
    order: start + index,
  }));
  if (rows.length) {
    const { error } = await supabase.from("question_pool_items").insert(rows);
    if (error) throw new Error(error.message);
  }
  return { added: rows.length + restore.length };
}

export async function addQuestionsToPool(poolId: string, questionIds: string[]) {
  const { supabase } = await requireUser();
  const unique = [...new Set(questionIds.filter(Boolean))];
  if (unique.length === 0) return { added: 0 };
  const { data, error } = await supabase.rpc("add_questions_to_pool", {
    p_pool_id: poolId,
    p_question_ids: unique,
  });
  if (!error) return { added: Number(data ?? 0) };
  if (!/add_questions_to_pool|schema cache|does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }
  return addQuestionsToPoolFallback(supabase, poolId, unique);
}

export async function createPoolWithQuestions(
  classId: string,
  name: string,
  questionIds: string[],
  settings?: { shuffle_on_play?: boolean; time_per_q?: number | null },
) {
  const { supabase } = await requireUser();
  const unique = [...new Set(questionIds.filter(Boolean))];
  const { data, error } = await supabase.rpc("create_pool_with_questions", {
    p_class_id: classId,
    p_name: name.trim() || "Untitled pool",
    p_shuffle_on_play: settings?.shuffle_on_play ?? true,
    p_time_per_q: settings?.time_per_q ?? null,
    p_question_ids: unique,
  });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return row as PoolRow & { added?: number };
  }
  if (!/create_pool_with_questions|schema cache|does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }
  const pool = await createPool(classId, name, settings);
  const added = await addQuestionsToPool(pool.id, unique);
  return { ...pool, added: added.added };
}

export async function removeQuestionsFromPool(poolId: string, questionIds: string[]) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("question_pool_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("pool_id", poolId)
    .in("question_id", questionIds);
  if (error) throw new Error(error.message);
}

export async function reorderPoolQuestions(poolId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();
  for (const [index, questionId] of orderedIds.entries()) {
    const { error } = await supabase
      .from("question_pool_items")
      .update({ order: index })
      .eq("pool_id", poolId)
      .eq("question_id", questionId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export async function getPoolWithQuestions(poolId: string): Promise<PoolWithQuestions> {
  const { supabase } = await requireUser();
  const { data: pool, error } = await supabase.from("question_pools").select("*").eq("id", poolId).single();
  if (error) throw new Error(error.message);
  const { data: items, error: itemsError } = await supabase
    .from("question_pool_items")
    .select("id, question_id, order, question:questions(*)")
    .eq("pool_id", poolId)
    .is("deleted_at", null)
    .order("order", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  return { pool: pool as PoolRow, items: (items ?? []) as unknown as PoolItem[] };
}

export function shufflePoolItems(items: PoolItem[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export async function softDeletePool(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("question_pools")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restorePool(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("question_pools").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}
