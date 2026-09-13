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

export async function createPool(classId: string, name: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("question_pools")
    .insert({ class_id: classId, name, shuffle_on_play: true })
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

export async function addQuestionsToPool(poolId: string, questionIds: string[]) {
  const { supabase } = await requireUser();
  const { data: existing } = await supabase
    .from("question_pool_items")
    .select("question_id, order")
    .eq("pool_id", poolId)
    .is("deleted_at", null);
  const have = new Set((existing ?? []).map((row) => row.question_id));
  const start = (existing ?? []).reduce((max, row) => Math.max(max, row.order ?? 0), -1) + 1;
  const rows = questionIds
    .filter((id) => !have.has(id))
    .map((question_id, index) => ({
      pool_id: poolId,
      question_id,
      order: start + index,
    }));
  if (!rows.length) return existing ?? [];
  const { error } = await supabase.from("question_pool_items").insert(rows);
  if (error) throw new Error(error.message);
  return rows;
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
