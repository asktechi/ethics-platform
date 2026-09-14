import { requireUser } from "@/lib/data/auth";

export type BossRow = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  portrait_emoji: string | null;
  portrait_url: string | null;
  max_hp: number;
  standard_id: string | null;
  phase_1_taunts: string[];
  phase_2_taunts: string[];
  phase_3_taunts: string[];
  victory_line: string | null;
  defeat_line: string | null;
  palette_json: { bg?: string; accent?: string; hpBar?: string };
  standard?: { id: string; code: string; title: string } | null;
};

function mapBoss(row: Record<string, unknown>): BossRow {
  const standardRaw = row.standard as { id: string; code: string; title: string } | { id: string; code: string; title: string }[] | null;
  const standard = Array.isArray(standardRaw) ? standardRaw[0] ?? null : standardRaw;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    subtitle: (row.subtitle as string | null) ?? null,
    portrait_emoji: (row.portrait_emoji as string | null) ?? null,
    portrait_url: (row.portrait_url as string | null) ?? null,
    max_hp: Number(row.max_hp ?? 400),
    standard_id: (row.standard_id as string | null) ?? null,
    phase_1_taunts: Array.isArray(row.phase_1_taunts) ? (row.phase_1_taunts as string[]) : [],
    phase_2_taunts: Array.isArray(row.phase_2_taunts) ? (row.phase_2_taunts as string[]) : [],
    phase_3_taunts: Array.isArray(row.phase_3_taunts) ? (row.phase_3_taunts as string[]) : [],
    victory_line: (row.victory_line as string | null) ?? null,
    defeat_line: (row.defeat_line as string | null) ?? null,
    palette_json: (row.palette_json as BossRow["palette_json"]) ?? {},
    standard,
  };
}

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

export type CombatLogEntry = {
  kind: "damage" | "heal" | "party_damage";
  name: string;
  amount: number;
  multiplier?: number;
  question_id?: string;
};

export type BossCombatView = {
  boss_hp: number;
  boss_max_hp: number;
  party_hp: number | null;
  party_max_hp: number;
  phase: number;
  play_mode: "solo" | "co-op";
  outcome: "ongoing" | "victory" | "defeat";
  defeat_reason: "party_hp_zero" | "questions_exhausted" | null;
  taunt: string | null;
  log: CombatLogEntry[];
  boss: BossRow | null;
};

export function parseBossCombat(raw: unknown): BossCombatView | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const bossRaw = row.boss as Record<string, unknown> | null | undefined;
  return {
    boss_hp: Number(row.boss_hp ?? 0),
    boss_max_hp: Number(row.boss_max_hp ?? 400),
    party_hp: row.party_hp == null ? null : Number(row.party_hp),
    party_max_hp: Number(row.party_max_hp ?? 300),
    phase: Number(row.phase ?? 1),
    play_mode: row.play_mode === "solo" ? "solo" : "co-op",
    outcome: row.outcome === "victory" || row.outcome === "defeat" ? row.outcome : "ongoing",
    defeat_reason:
      row.defeat_reason === "party_hp_zero" || row.defeat_reason === "questions_exhausted"
        ? row.defeat_reason
        : null,
    taunt: typeof row.taunt === "string" ? row.taunt : null,
    log: Array.isArray(row.log) ? (row.log as CombatLogEntry[]) : [],
    boss: bossRaw ? mapBoss(bossRaw) : null,
  };
}

export async function getBossCombatForSession(sessionId: string): Promise<BossCombatView | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_boss_combat", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  return parseBossCombat(data);
}
