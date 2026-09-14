"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateQuestions } from "@/lib/ai/generation";
import { tagQuestionsBatch } from "@/lib/ai/tagging";
import { classAiSpend } from "@/lib/ai/usage";
import { requireUser } from "@/lib/data/auth";
import { listConceptsByClass } from "@/lib/data/concepts";
import { actionError } from "@/lib/data/errors";
import {
  applyTagApprovals,
  bulkUpdateQuestions,
  countQuestions,
  insertGeneratedQuestions,
  listQuestionIds,
  listQuestions,
  untaggedQuestionIds,
  updateQuestion,
  type QuestionFilters,
} from "@/lib/data/questions";
import { listStandards } from "@/lib/data/standards";
import { createAdminClient } from "@/lib/supabase/admin";

function refresh(classId: string) {
  revalidatePath(`/class/${classId}`);
  revalidatePath(`/class/${classId}/questions`);
  revalidatePath(`/class/${classId}/questions/generate`);
  revalidatePath(`/class/${classId}/questions/pools`);
}

export async function listQuestionsAction(classId: string, filters: QuestionFilters) {
  try {
    return { ok: true as const, questions: await listQuestions(classId, filters) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function countMatchingQuestionsAction(classId: string, filters: QuestionFilters) {
  try {
    return { ok: true as const, count: await countQuestions(classId, filters) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function listMatchingQuestionIdsAction(classId: string, filters: QuestionFilters) {
  try {
    return { ok: true as const, ids: await listQuestionIds(classId, filters) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function autoTagUntaggedAction(classId: string, questionIds?: string[]) {
  try {
    const { user } = await requireUser();
    const [ids, standards, concepts] = await Promise.all([
      questionIds?.length ? Promise.resolve(questionIds) : untaggedQuestionIds(classId),
      listStandards(),
      listConceptsByClass(classId),
    ]);
    if (ids.length === 0) return { ok: true as const, results: [], cost: 0 };
    const { results, cost } = await tagQuestionsBatch(
      ids,
      {
        standards: standards.map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
        })),
        concepts: concepts.map((item) => ({ id: item.id, title: item.title, name: item.title })),
      },
      { userId: user.id, classId },
    );
    refresh(classId);
    return { ok: true as const, results, cost };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function approveTagProposalsAction(
  classId: string,
  items: Array<{
    questionId: string;
    standard_id: string | null;
    concept_id: string | null;
    difficulty: "easy" | "medium" | "hard";
    confidence: number;
    reasoning: string;
  }>,
) {
  try {
    await applyTagApprovals(items);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function updateQuestionAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      id: z.string().uuid(),
      stem: z.string().optional(),
      choices_json: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
      answer_key: z.string().nullable().optional(),
      explanation: z.string().nullable().optional(),
      standard_id: z.string().uuid().nullable().optional(),
      concept_id: z.string().uuid().nullable().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).nullable().optional(),
      approved: z.boolean().optional(),
      rejected: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid question" };
  try {
    const { classId, id, ...patch } = parsed.data;
    await updateQuestion(id, patch);
    refresh(classId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function bulkQuestionAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      ids: z.array(z.string().uuid()).min(1),
      action: z.enum(["approve", "reject", "delete", "restore"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid bulk action" };
  try {
    if (parsed.data.action === "approve") {
      await bulkUpdateQuestions(parsed.data.ids, { approved: true, rejected: false });
    } else if (parsed.data.action === "reject") {
      await bulkUpdateQuestions(parsed.data.ids, { approved: false, rejected: true });
    } else if (parsed.data.action === "delete") {
      await bulkUpdateQuestions(parsed.data.ids, { deleted_at: new Date().toISOString() });
    } else {
      await bulkUpdateQuestions(parsed.data.ids, { deleted_at: null });
    }
    refresh(parsed.data.classId);
    return { ok: true as const, count: parsed.data.ids.length };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function generateQuestionsAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      standardId: z.string().uuid(),
      conceptId: z.string().uuid().optional(),
      count: z.number().int().min(1).max(20),
      difficulty: z.enum(["easy", "medium", "hard"]),
      style: z.enum(["mcq", "scenario", "mixed"]),
      sourceText: z.string().optional(),
      slideIds: z.array(z.string().uuid()).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Fill the generate form completely." };
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { data: standard, error } = await admin
      .from("standards")
      .select("id, title, body")
      .eq("id", parsed.data.standardId)
      .single();
    if (error || !standard) return { ok: false as const, error: "Standard not found." };
    let conceptName: string | null = null;
    if (parsed.data.conceptId) {
      const { data: concept } = await admin
        .from("concepts")
        .select("title")
        .eq("id", parsed.data.conceptId)
        .maybeSingle();
      conceptName = concept?.title ?? null;
    }
    let slideText = "";
    if (parsed.data.slideIds?.length) {
      const { data: slides } = await admin
        .from("slides")
        .select("title, body")
        .in("id", parsed.data.slideIds)
        .eq("status", "approved")
        .is("deleted_at", null);
      slideText = (slides ?? [])
        .map((slide) => `${slide.title ?? ""}\n${slide.body ?? ""}`.trim())
        .filter(Boolean)
        .join("\n\n");
    }
    const sourceText = [parsed.data.sourceText?.trim(), slideText, standard.body]
      .filter(Boolean)
      .join("\n\n");
    if (sourceText.length < 20) {
      return { ok: false as const, error: "Paste source text or pick approved slides." };
    }
    const drafts = await generateQuestions({
      classId: parsed.data.classId,
      userId: user.id,
      standardTitle: standard.title,
      standardBody: standard.body ?? "",
      conceptName,
      count: parsed.data.count,
      difficulty: parsed.data.difficulty,
      sourceText,
      style: parsed.data.style,
    });
    const inserted = await insertGeneratedQuestions(
      parsed.data.classId,
      drafts.map((draft) => ({
        ...draft,
        standard_id: parsed.data.standardId,
        concept_id: parsed.data.conceptId ?? null,
        difficulty: parsed.data.difficulty,
      })),
    );
    refresh(parsed.data.classId);
    return { ok: true as const, drafts, inserted };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function aiSpendAction(classId: string) {
  try {
    return { ok: true as const, spend: await classAiSpend(classId) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export { listQuestions };
