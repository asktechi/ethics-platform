import { requireUser } from "@/lib/data/auth";
import {
  mapBoss,
  parseBossCombat,
  type BossCombatView,
  type BossRow,
} from "@/lib/games/boss-view";

export type { BossCombatView, BossRow, CombatLogEntry } from "@/lib/games/boss-view";
export { parseBossCombat } from "@/lib/games/boss-view";

export async function listBosses(): Promise<BossRow[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("bosses")
    .select("*, standard:standards(id, code, title)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBoss(row as Record<string, unknown>));
}

export async function getBoss(id: string): Promise<BossRow | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("bosses")
    .select("*, standard:standards(id, code, title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapBoss(data as Record<string, unknown>);
}

export async function getBossCombatForSession(sessionId: string): Promise<BossCombatView | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_boss_combat", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return parseBossCombat(data);
}
