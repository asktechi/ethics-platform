import { requireUser } from "@/lib/data/auth";
import type { Standard } from "@/types/db.helpers";

export async function listStandards(): Promise<Standard[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("standards")
    .select("*")
    .is("deleted_at", null)
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Standard[];
}
