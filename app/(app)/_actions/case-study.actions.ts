"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import {
  archiveCaseStudy,
  createCaseStudy,
  listCaseStudies,
  updateCaseStudy,
} from "@/lib/data/case-studies";
import { listQuestions } from "@/lib/data/questions";

const saveSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1),
  scenarioText: z.string().min(1),
  scenarioMediaUrl: z.string().nullable().optional(),
  questionIds: z.array(z.string().uuid()),
});

export async function listCaseStudiesAction(classId: string) {
  try {
    return { ok: true as const, cases: await listCaseStudies(classId) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function searchCaseQuestionsAction(classId: string, search: string) {
  try {
    const questions = await listQuestions(classId, {
      includeArchived: false,
      search,
      status: "approved",
    });
    return {
      ok: true as const,
      questions: questions.map((row) => ({
        id: row.id,
        stem: row.stem,
        standard: row.standard?.code ?? null,
      })),
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function saveCaseStudyAction(input: unknown) {
  try {
    const parsed = saveSchema.parse(input);
    const row = await createCaseStudy(parsed);
    revalidatePath(`/class/${parsed.classId}/cases`);
    revalidatePath(`/class/${parsed.classId}`);
    return { ok: true as const, id: row.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function updateCaseStudyAction(id: string, input: unknown) {
  try {
    const parsed = saveSchema.partial().extend({ classId: z.string().uuid().optional() }).parse(input);
    const row = await updateCaseStudy(id, {
      title: parsed.title,
      scenarioText: parsed.scenarioText,
      scenarioMediaUrl: parsed.scenarioMediaUrl,
      questionIds: parsed.questionIds,
    });
    revalidatePath(`/class/${row.class_id}/cases`);
    return { ok: true as const, id: row.id };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function archiveCaseStudyAction(id: string, classId: string) {
  try {
    await archiveCaseStudy(id);
    revalidatePath(`/class/${classId}/cases`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
