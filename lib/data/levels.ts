import type { Level } from "@/types/db.helpers";
import { requireUser } from "@/lib/data/auth";
import { requireValue } from "@/lib/data/errors";

export async function listLevels(): Promise<Level[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("levels")
    .select("*")
    .is("deleted_at", null)
    .order("order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Level[];
}

export async function getLevelBySlug(slug: string): Promise<{
  level: Level;
  classCount: number;
}> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("levels")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const level = requireValue(data as Level | null, "Level not found.");

  const { count, error: countError } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("level_id", level.id)
    .is("deleted_at", null);

  if (countError) {
    throw new Error(countError.message);
  }

  return { level, classCount: count ?? 0 };
}

export const levelCopy: Record<string, string> = {
  "level-1":
    "Ethical and Professional Standards — foundations of the Code and Standards.",
  "level-2":
    "Application of the Standards to research, issuer relations, and conflicts.",
  "level-3":
    "Duties to clients, portfolio construction, and professional conduct in practice.",
};
