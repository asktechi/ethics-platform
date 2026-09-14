import { computeBossDamage, DEFAULT_BOSS_CONFIG, asBossConfig } from "@/lib/games/boss-combat";
import type { GameModeDefinition, ScoreResponseArgs } from "@/lib/games/modes/types";

export function bossScoreResponse(args: ScoreResponseArgs) {
  const config = asBossConfig({
    ...DEFAULT_BOSS_CONFIG,
    base_damage: args.baseDamage ?? DEFAULT_BOSS_CONFIG.base_damage,
    time_bonus_damage: args.timeBonusDamage ?? DEFAULT_BOSS_CONFIG.time_bonus_damage,
    wrong_answer_penalty: args.wrongAnswerPenalty ?? DEFAULT_BOSS_CONFIG.wrong_answer_penalty,
    streak_damage_multiplier: args.streakDamageMultiplier ?? DEFAULT_BOSS_CONFIG.streak_damage_multiplier,
  });
  const scored = computeBossDamage({
    isCorrect: args.isCorrect,
    msTaken: args.msTaken,
    timeLimitMs: args.timeLimitMs,
    priorCorrect: args.priorCorrect,
    difficulty: args.difficulty,
    config,
  });
  return { points: scored.damage, bonusReason: scored.bonusReason };
}

export const bossBattleMode: GameModeDefinition = {
  id: "boss_battle",
  name: "Boss Battle",
  shortDescription: "Narrative campaign; correct answers deal damage.",
  longDescription:
    "The class fights a named ethical failure. Correct answers deal damage. Wrong answers heal the boss or wound the party. Three phases as HP drops, then a victory or defeat ending.",
  icon: "♛",
  accentColor: "#E63946",
  status: "playable",
  configSchema: [
    { key: "mode", label: "Play mode", type: "string", default: "co-op" },
    { key: "base_damage", label: "Base damage", type: "number", default: 40, min: 1, max: 200 },
    { key: "time_bonus_damage", label: "Time bonus damage", type: "number", default: 20, min: 0, max: 100 },
    { key: "wrong_answer_penalty", label: "Wrong-answer penalty", type: "string", default: "boss_heal" },
    { key: "boss_heal_amount", label: "Boss heal on miss", type: "number", default: 15, min: 0, max: 100 },
    { key: "party_damage_amount", label: "Party damage on miss", type: "number", default: 20, min: 0, max: 100 },
    { key: "party_max_hp", label: "Party max HP", type: "number", default: 300, min: 50, max: 2000 },
    { key: "streak_damage_multiplier", label: "Streak damage multiplier", type: "boolean", default: true },
    { key: "phases_enabled", label: "Phase taunts as HP drops", type: "boolean", default: true },
  ],
  scoreResponse: bossScoreResponse,
};
