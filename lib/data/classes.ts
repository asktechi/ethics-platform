import type { Class, Level } from "@/types/db.helpers";
import { ensureInstructorRow, requireUser } from "@/lib/data/auth";
import { requireValue } from "@/lib/data/errors";

export type ClassListItem = Class & { archived: boolean };

export type ClassDetail = Class & {
  level: Level;
  sectionCount: number;
  conceptCount: number;
  materialCount: number;
  questionCount: number;
};

type ListOptions = {
  includeArchived?: boolean;
};

export async function listClassesByLevel(
  levelId: string,
  options: ListOptions = {},
): Promise<ClassListItem[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("classes")
    .select("*")
    .eq("level_id", levelId)
    .order("updated_at", { ascending: false });

  if (!options.includeArchived) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Class[]).map((row) => ({
    ...row,
    archived: Boolean(row.deleted_at),
  }));
}

export async function listRecentClasses(limit = 5): Promise<Class[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Class[];
}

export async function getClass(id: string): Promise<ClassDetail> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .select("*, level:levels(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = requireValue(data, "Class not found.") as Class & { level: Level };

  const [sections, concepts, materials, questions] = await Promise.all([
    supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .is("deleted_at", null),
    supabase
      .from("concepts")
      .select("id, sections!inner(class_id, deleted_at)", {
        count: "exact",
        head: true,
      })
      .eq("sections.class_id", id)
      .is("deleted_at", null)
      .is("sections.deleted_at", null),
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .is("deleted_at", null),
    countClassQuestions(id),
  ]);

  if (sections.error) throw new Error(sections.error.message);
  if (concepts.error) throw new Error(concepts.error.message);
  if (materials.error) throw new Error(materials.error.message);

  return {
    ...row,
    level: row.level,
    sectionCount: sections.count ?? 0,
    conceptCount: concepts.count ?? 0,
    materialCount: materials.count ?? 0,
    questionCount: questions,
  };
}

async function countClassQuestions(classId: string): Promise<number> {
  const { supabase } = await requireUser();
  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function createClass(input: {
  levelId: string;
  title: string;
  audience?: string;
  description?: string;
}): Promise<Class> {
  const { supabase, user } = await ensureInstructorRow();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      level_id: input.levelId,
      title: input.title.trim(),
      audience: input.audience?.trim() || null,
      description: input.description?.trim() || null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Class;
}

export async function updateClass(
  id: string,
  patch: Partial<Pick<Class, "title" | "audience" | "description">>,
): Promise<Class> {
  const { supabase } = await requireUser();
  const payload: Record<string, string | null> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.audience !== undefined) {
    payload.audience = patch.audience?.trim() || null;
  }
  if (patch.description !== undefined) {
    payload.description = patch.description?.trim() || null;
  }

  const { data, error } = await supabase
    .from("classes")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Class;
}

export async function softDeleteClass(id: string): Promise<Class> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Class;
}

export async function restoreClass(id: string): Promise<Class> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("classes")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Class;
}
