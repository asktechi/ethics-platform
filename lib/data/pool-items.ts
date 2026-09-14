import type { QuestionRow } from "@/lib/data/questions";

export function asJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function normalizePoolItems(
  rows: Array<{ id: string; question_id: string; order: number; question?: unknown }>,
) {
  return rows.map((row) => {
    const joined = asJoinedRecord(row.question as QuestionRow | QuestionRow[] | null);
    const question: QuestionRow = joined
      ? { ...joined, id: joined.id || row.question_id }
      : {
          id: row.question_id,
          stem: "This question is missing or was archived.",
          choices_json: [],
          answer_key: null,
          explanation: null,
          standard_id: null,
          concept_id: null,
          difficulty: null,
          source: "mine",
          approved: false,
          rejected: false,
          tag_approved: false,
          ai_tag_confidence: null,
          ai_tag_reasoning: null,
          import_batch_id: null,
          class_id: null,
          created_by: "",
          created_at: "",
          updated_at: "",
          deleted_at: new Date().toISOString(),
        };
    return {
      id: row.id,
      question_id: row.question_id,
      order: row.order,
      question,
    };
  });
}
