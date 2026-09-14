import { requireUser } from "@/lib/data/auth";
import type { QuestionRow } from "@/lib/data/questions";

export type CaseStudyRow = {
  id: string;
  class_id: string;
  title: string;
  scenario_text: string;
  scenario_media_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  question_count?: number;
  tags?: string[];
  questions?: QuestionRow[];
};

export async function listCaseStudies(classId: string): Promise<CaseStudyRow[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const cases = (data ?? []) as CaseStudyRow[];
  if (!cases.length) return [];
  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("id, stem, case_study_id, case_study_order, standard:standards(code, title), approved, deleted_at")
    .eq("class_id", classId)
    .in("case_study_id", cases.map((row) => row.id))
    .is("deleted_at", null)
    .order("case_study_order", { ascending: true });
  if (qError) throw new Error(qError.message);
  const grouped = new Map<string, QuestionRow[]>();
  for (const question of (questions ?? []) as unknown as QuestionRow[]) {
    const key = question.case_study_id;
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(question);
    grouped.set(key, list);
  }
  return cases.map((row) => {
    const attached = grouped.get(row.id) ?? [];
    const tags = [
      ...new Set(
        attached
          .map((item) => item.standard?.code)
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    return { ...row, questions: attached, question_count: attached.length, tags };
  });
}

export async function getCaseStudy(id: string): Promise<CaseStudyRow> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("case_studies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.deleted_at) throw new Error("Case not found.");
  const { data: questions, error: qError } = await supabase
    .from("questions")
    .select("*, standard:standards(id, code, title), concept:concepts(id, title)")
    .eq("case_study_id", id)
    .is("deleted_at", null)
    .order("case_study_order", { ascending: true });
  if (qError) throw new Error(qError.message);
  return {
    ...(data as CaseStudyRow),
    questions: (questions ?? []) as unknown as QuestionRow[],
    question_count: questions?.length ?? 0,
  };
}

export async function createCaseStudy(input: {
  classId: string;
  title: string;
  scenarioText: string;
  scenarioMediaUrl?: string | null;
  questionIds: string[];
}) {
  const { supabase, user } = await requireUser();
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!input.scenarioText.trim()) throw new Error("Scenario text is required.");
  const { data, error } = await supabase
    .from("case_studies")
    .insert({
      class_id: input.classId,
      title: input.title.trim(),
      scenario_text: input.scenarioText.trim(),
      scenario_media_url: input.scenarioMediaUrl ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await attachQuestionsToCase(data.id, input.questionIds);
  return data;
}

export async function updateCaseStudy(
  id: string,
  input: {
    title?: string;
    scenarioText?: string;
    scenarioMediaUrl?: string | null;
    questionIds?: string[];
  },
) {
  await getCaseStudy(id);
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.scenarioText !== undefined) patch.scenario_text = input.scenarioText.trim();
  if (input.scenarioMediaUrl !== undefined) patch.scenario_media_url = input.scenarioMediaUrl;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("case_studies").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }
  if (input.questionIds) await attachQuestionsToCase(id, input.questionIds);
  return getCaseStudy(id);
}

export async function archiveCaseStudy(id: string, restore = false) {
  await getCaseStudy(id);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("case_studies")
    .update({ deleted_at: restore ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (!restore) {
    await supabase.from("questions").update({ case_study_id: null, case_study_order: null }).eq("case_study_id", id);
  }
}

async function attachQuestionsToCase(caseId: string, questionIds: string[]) {
  const { supabase } = await requireUser();
  const unique = [...new Set(questionIds)];
  const { error: clearError } = await supabase
    .from("questions")
    .update({ case_study_id: null, case_study_order: null })
    .eq("case_study_id", caseId);
  if (clearError) throw new Error(clearError.message);
  for (let index = 0; index < unique.length; index += 1) {
    const { error } = await supabase
      .from("questions")
      .update({ case_study_id: caseId, case_study_order: index })
      .eq("id", unique[index]);
    if (error) throw new Error(error.message);
  }
}
