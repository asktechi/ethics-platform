import type { Concept } from "@/types/db.helpers";
import { requireUser } from "@/lib/data/auth";

type ListOptions = {
  includeArchived?: boolean;
};

export async function listConcepts(
  sectionId: string,
  options: ListOptions = {},
): Promise<Concept[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("concepts")
    .select("*")
    .eq("section_id", sectionId)
    .order("order", { ascending: true });

  if (!options.includeArchived) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Concept[];
}

export async function listConceptsByClass(
  classId: string,
  options: ListOptions = {},
): Promise<Concept[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("concepts")
    .select("*, sections!inner(class_id)")
    .eq("sections.class_id", classId)
    .order("order", { ascending: true });

  if (!options.includeArchived) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Concept[];
}

async function nextConceptOrder(sectionId: string): Promise<number> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("concepts")
    .select("order")
    .eq("section_id", sectionId)
    .order("order", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data?.[0] as { order?: number } | undefined)?.order ?? 0) + 1;
}

export async function createConcept(input: {
  sectionId: string;
  title: string;
}): Promise<Concept> {
  const { supabase } = await requireUser();
  const order = await nextConceptOrder(input.sectionId);
  const { data, error } = await supabase
    .from("concepts")
    .insert({
      section_id: input.sectionId,
      title: input.title.trim(),
      order,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Concept;
}

export async function updateConcept(
  id: string,
  patch: Partial<Pick<Concept, "title" | "order">>,
): Promise<Concept> {
  const { supabase } = await requireUser();
  const payload: Record<string, string | number> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.order !== undefined) payload.order = patch.order;

  const { data, error } = await supabase
    .from("concepts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Concept;
}

export async function reorderConcepts(
  sectionId: string,
  orderedIds: string[],
): Promise<void> {
  const { supabase } = await requireUser();
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("concepts")
      .update({ order: index + 1 })
      .eq("id", id)
      .eq("section_id", sectionId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw new Error(failed.error.message);
  }
}

export async function softDeleteConcept(id: string): Promise<Concept> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("concepts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Concept;
}

export async function restoreConcept(id: string): Promise<Concept> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("concepts")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Concept;
}
