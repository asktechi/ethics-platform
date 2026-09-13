import { requireUser } from "@/lib/data/auth";
import type { CanonicalQuestion } from "@/lib/importers/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuestionFilters = {
  standardIds?: string[];
  conceptIds?: string[];
  difficulty?: Array<"easy" | "medium" | "hard">;
  status?: "all" | "pending" | "approved" | "rejected";
  statuses?: Array<"pending" | "approved" | "rejected">;
  source?: "all" | "imported" | "ai_generated" | "mine";
  sources?: Array<"imported" | "ai_generated" | "mine">;
  search?: string;
  includeArchived?: boolean;
  minConfidence?: number | null;
};

export type QuestionRow = {
  id: string;
  stem: string;
  choices_json: Array<{ key: string; text: string }> | null;
  answer_key: string | null;
  explanation: string | null;
  standard_id: string | null;
  concept_id: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  source: "mine" | "imported" | "ai_generated";
  approved: boolean;
  rejected: boolean;
  tag_approved: boolean;
  ai_tag_confidence: number | null;
  ai_tag_reasoning: string | null;
  import_batch_id: string | null;
  class_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  standard?: { id: string; code: string; title: string } | null;
  concept?: { id: string; title: string } | null;
};

function applyQuestionFilters<T>(query: T, filters: QuestionFilters): T {
  type Chain = T & {
    eq: (column: string, value: unknown) => Chain;
    in: (column: string, value: unknown[]) => Chain;
    is: (column: string, value: unknown) => Chain;
    ilike: (column: string, value: string) => Chain;
    gte: (column: string, value: number) => Chain;
    or: (value: string) => Chain;
  };
  let next = query as Chain;
  if (!filters.includeArchived) next = next.is("deleted_at", null);
  if (filters.standardIds?.length) next = next.in("standard_id", filters.standardIds);
  if (filters.conceptIds?.length) next = next.in("concept_id", filters.conceptIds);
  if (filters.difficulty?.length) next = next.in("difficulty", filters.difficulty);
  if (filters.sources?.length) next = next.in("source", filters.sources);
  else if (filters.source && filters.source !== "all") next = next.eq("source", filters.source);
  if (filters.search?.trim()) next = next.ilike("stem", `%${filters.search.trim()}%`);
  const statuses = filters.statuses?.length ? filters.statuses : filters.status && filters.status !== "all" ? [filters.status] : [];
  if (statuses.length === 1) {
    if (statuses[0] === "approved") next = next.eq("approved", true);
    if (statuses[0] === "rejected") next = next.eq("rejected", true);
    if (statuses[0] === "pending") next = next.eq("approved", false).eq("rejected", false);
  } else if (statuses.length > 1) {
    const parts = statuses.map((item) =>
      item === "pending" ? "and(approved.eq.false,rejected.eq.false)" : item === "approved" ? "approved.eq.true" : "rejected.eq.true",
    );
    next = next.or(parts.join(","));
  }
  if (typeof filters.minConfidence === "number") next = next.gte("ai_tag_confidence", filters.minConfidence);
  return next;
}

export async function listQuestions(classId: string, filters: QuestionFilters = {}) {
  const { supabase } = await requireUser();
  const query = applyQuestionFilters(
    supabase
      .from("questions")
      .select("*, standard:standards(id, code, title), concept:concepts(id, title)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }),
    filters,
  );
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QuestionRow[];
}

export async function countQuestions(classId: string, filters: QuestionFilters = {}) {
  const { supabase } = await requireUser();
  const query = applyQuestionFilters(
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("class_id", classId),
    filters,
  );
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listQuestionIds(classId: string, filters: QuestionFilters = {}) {
  const { supabase } = await requireUser();
  const query = applyQuestionFilters(
    supabase.from("questions").select("id").eq("class_id", classId).order("created_at", { ascending: false }),
    filters,
  );
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

export async function commitReviewedQuestions(input: {
  classId: string;
  questions: CanonicalQuestion[];
  importBatchName: string;
}) {
  const { supabase, user } = await requireUser();
  const rowsInput = input.questions.filter((question) => question.stem.trim().length > 0);
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      class_id: input.classId,
      filename: input.importBatchName,
      question_count: rowsInput.length,
      imported_by: user.id,
    })
    .select("*")
    .single();
  if (batchError) throw new Error(batchError.message);

  if (rowsInput.length === 0) {
    return { batchId: batch.id, importedCount: 0, questionIds: [] as string[] };
  }

  const rows = rowsInput.map((question) => ({
    class_id: input.classId,
    stem: question.stem,
    choices_json: question.choices,
    answer_key: question.answer_key,
    explanation: question.explanation,
    source: "imported" as const,
    approved: false,
    rejected: false,
    tag_approved: false,
    created_by: user.id,
    import_batch_id: batch.id,
  }));

  const { data, error } = await supabase.from("questions").insert(rows).select("id");
  if (error) {
    await supabase.from("import_batches").delete().eq("id", batch.id);
    throw new Error(error.message);
  }
  return {
    batchId: batch.id,
    importedCount: data?.length ?? 0,
    questionIds: (data ?? []).map((row) => row.id),
  };
}

export async function updateQuestion(
  id: string,
  patch: Partial<{
    stem: string;
    choices_json: Array<{ key: string; text: string }>;
    answer_key: string | null;
    explanation: string | null;
    standard_id: string | null;
    concept_id: string | null;
    difficulty: "easy" | "medium" | "hard" | null;
    approved: boolean;
    rejected: boolean;
    tag_approved: boolean;
    ai_tag_confidence: number | null;
    ai_tag_reasoning: string | null;
  }>,
) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("questions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteQuestion(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("questions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restoreQuestion(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("questions").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function applyTagApprovals(
  items: Array<{
    questionId: string;
    standard_id: string | null;
    concept_id: string | null;
    difficulty: "easy" | "medium" | "hard";
    confidence: number;
    reasoning: string;
  }>,
) {
  for (const item of items) {
    await updateQuestion(item.questionId, {
      standard_id: item.standard_id,
      concept_id: item.concept_id,
      difficulty: item.difficulty,
      ai_tag_confidence: item.confidence,
      ai_tag_reasoning: item.reasoning,
      tag_approved: true,
    });
  }
}

export async function insertGeneratedQuestions(
  classId: string,
  drafts: Array<{
    stem: string;
    choices: Array<{ key: string; text: string }>;
    answer_key: string;
    explanation: string;
    reasoning: string;
    standard_id: string | null;
    concept_id: string | null;
    difficulty: "easy" | "medium" | "hard";
  }>,
) {
  const { supabase, user } = await requireUser();
  const rows = drafts.map((draft) => ({
    class_id: classId,
    stem: draft.stem,
    choices_json: draft.choices,
    answer_key: draft.answer_key,
    explanation: draft.explanation,
    standard_id: draft.standard_id,
    concept_id: draft.concept_id,
    difficulty: draft.difficulty,
    source: "ai_generated" as const,
    approved: false,
    rejected: false,
    tag_approved: false,
    ai_tag_reasoning: draft.reasoning,
    created_by: user.id,
  }));
  const { data, error } = await supabase.from("questions").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function untaggedQuestionIds(classId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("class_id", classId)
    .eq("tag_approved", false)
    .is("deleted_at", null)
    .is("standard_id", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

export async function classAiSpendForUser(classId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("ai_usage_log").select("cost_usd").eq("class_id", classId);
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}
