export type BossPenalty = "boss_heal" | "party_damage";

export type BossCombatConfig = {
  mode: "solo" | "co-op";
  base_damage: number;
  time_bonus_damage: number;
  wrong_answer_penalty: BossPenalty;
  boss_heal_amount: number;
  party_damage_amount: number;
  party_max_hp: number;
  streak_damage_multiplier: boolean;
  phases_enabled: boolean;
};

export const DEFAULT_BOSS_CONFIG: BossCombatConfig = {
  mode: "co-op",
  base_damage: 40,
  time_bonus_damage: 20,
  wrong_answer_penalty: "boss_heal",
  boss_heal_amount: 15,
  party_damage_amount: 20,
  party_max_hp: 300,
  streak_damage_multiplier: true,
  phases_enabled: true,
};

export function asBossConfig(raw: Record<string, unknown> | null | undefined): BossCombatConfig {
  const value = raw ?? {};
  const penalty = value.wrong_answer_penalty === "party_damage" ? "party_damage" : "boss_heal";
  return {
    mode: value.mode === "solo" ? "solo" : "co-op",
    base_damage: Number(value.base_damage ?? DEFAULT_BOSS_CONFIG.base_damage),
    time_bonus_damage: Number(value.time_bonus_damage ?? DEFAULT_BOSS_CONFIG.time_bonus_damage),
    wrong_answer_penalty: penalty,
    boss_heal_amount: Number(value.boss_heal_amount ?? DEFAULT_BOSS_CONFIG.boss_heal_amount),
    party_damage_amount: Number(value.party_damage_amount ?? DEFAULT_BOSS_CONFIG.party_damage_amount),
    party_max_hp: Number(value.party_max_hp ?? DEFAULT_BOSS_CONFIG.party_max_hp),
    streak_damage_multiplier: value.streak_damage_multiplier !== false,
    phases_enabled: value.phases_enabled !== false,
  };
}

export function difficultyBonus(difficulty: string | null | undefined) {
  if (difficulty === "hard") return 20;
  if (difficulty === "medium") return 10;
  return 0;
}

export function streakMultiplier(priorCorrect: number, enabled: boolean) {
  if (!enabled) return 1;
  if (priorCorrect >= 3) return 2;
  if (priorCorrect >= 2) return 1.5;
  return 1;
}

export function computeBossDamage(args: {
  isCorrect: boolean;
  msTaken: number;
  timeLimitMs: number;
  priorCorrect: number;
  difficulty?: string | null;
  config: BossCombatConfig;
}) {
  if (!args.isCorrect) {
    return {
      damage: 0,
      multiplier: 1,
      bonusReason: args.config.wrong_answer_penalty === "party_damage" ? "party_damaged" : "boss_healed",
    };
  }
  const limit = Math.max(1, args.timeLimitMs);
  const elapsed = Math.min(Math.max(0, args.msTaken), limit);
  const timePortion = args.config.time_bonus_damage * (1 - elapsed / limit);
  const raw =
    args.config.base_damage + timePortion + difficultyBonus(args.difficulty);
  const multiplier = streakMultiplier(args.priorCorrect, args.config.streak_damage_multiplier);
  const damage = Math.max(0, Math.round(raw * multiplier));
  return {
    damage,
    multiplier,
    bonusReason: multiplier > 1 ? `damage x${multiplier}` : "damage",
  };
}

export function phaseFromHp(hp: number, maxHp: number, enabled: boolean) {
  if (!enabled) return 1;
  const ratio = maxHp <= 0 ? 0 : hp / maxHp;
  if (ratio > 0.66) return 1;
  if (ratio >= 0.33) return 2;
  return 3;
}

export function estimatedQuestionsToKill(maxHp: number, config: BossCombatConfig) {
  const avg = config.base_damage + config.time_bonus_damage * 0.5 + 10;
  return Math.max(1, Math.ceil(maxHp / Math.max(1, avg)));
}
