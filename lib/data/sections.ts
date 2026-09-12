import type { Section } from "@/types/db.helpers";
import { requireUser } from "@/lib/data/auth";

type ListOptions = {
  includeArchived?: boolean;
};

export async function listSections(
  classId: string,
  options: ListOptions = {},
): Promise<Section[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("sections")
    .select("*")
    .eq("class_id", classId)
    .order("order", { ascending: true });

  if (!options.includeArchived) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Section[];
}

async function nextSectionOrder(classId: string): Promise<number> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sections")
    .select("order")
    .eq("class_id", classId)
    .order("order", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data?.[0] as { order?: number } | undefined)?.order ?? 0) + 1;
}

export async function createSection(input: {
  classId: string;
  title: string;
}): Promise<Section> {
  const { supabase } = await requireUser();
  const order = await nextSectionOrder(input.classId);
  const { data, error } = await supabase
    .from("sections")
    .insert({
      class_id: input.classId,
      title: input.title.trim(),
      order,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Section;
}

export async function updateSection(
  id: string,
  patch: Partial<Pick<Section, "title" | "order">>,
): Promise<Section> {
  const { supabase } = await requireUser();
  const payload: Record<string, string | number> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.order !== undefined) payload.order = patch.order;

  const { data, error } = await supabase
    .from("sections")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Section;
}

export async function reorderSections(
  classId: string,
  orderedIds: string[],
): Promise<void> {
  const { supabase } = await requireUser();
  const updates = orderedIds.map((id, index) =>
    supabase.from("sections").update({ order: index + 1 }).eq("id", id).eq("class_id", classId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}

export async function softDeleteSection(id: string): Promise<Section> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sections")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Section;
}

export async function restoreSection(id: string): Promise<Section> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sections")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Section;
}
