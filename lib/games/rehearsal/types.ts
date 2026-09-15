export const BOT_NAMES = [
  "Alice",
  "Marcus",
  "Priya",
  "Diego",
  "Yuki",
  "Chinua",
  "Fatima",
  "Lars",
  "Sofia",
  "Tariq",
  "Emma",
  "Chen",
  "Aisha",
  "Noah",
  "Leila",
  "Kwame",
  "Hana",
  "Omar",
  "Zoe",
  "Viktor",
] as const;

export type BotProfile = "perfect" | "mixed" | "struggler" | "random";

export type QuestionScope = "all" | "first_5" | { from: number; to: number };

export type RehearsalConfig = {
  bot_count: number;
  bot_profiles: BotProfile[] | "random";
  fast_forward: boolean;
  time_multiplier: 1 | 2 | 4;
  question_scope: QuestionScope;
  bots?: RehearsalBotRecord[];
};

export type RehearsalBotRecord = {
  participant_id: string;
  display_name: string;
  profile: BotProfile;
  participant_token: string;
  avatar_color: string;
};

export type RehearsalLaunchInput = {
  bot_count: 1 | 3 | 5 | 10;
  bot_profiles: BotProfile[] | "random";
  fast_forward: boolean;
  question_scope: QuestionScope;
};

export const DEFAULT_REHEARSAL: RehearsalLaunchInput = {
  bot_count: 3,
  bot_profiles: ["mixed"],
  fast_forward: true,
  question_scope: "all",
};

export const BOT_DELAY_MS: Record<BotProfile, { min: number; max: number }> = {
  perfect: { min: 2000, max: 6000 },
  mixed: { min: 3000, max: 12000 },
  struggler: { min: 5000, max: 20000 },
  random: { min: 3000, max: 15000 },
};

export const BOT_ACCURACY: Record<BotProfile, number> = {
  perfect: 1,
  mixed: 0.7,
  struggler: 0.4,
  random: 0.5,
};

export function parseRehearsalConfig(raw: unknown): RehearsalConfig {
  const value = (raw ?? {}) as Partial<RehearsalConfig>;
  const multiplier = Number(value.time_multiplier ?? 1);
  const time_multiplier = multiplier === 4 ? 4 : multiplier === 2 ? 2 : 1;
  return {
    bot_count: Number(value.bot_count ?? 3),
    bot_profiles: value.bot_profiles ?? ["mixed"],
    fast_forward: value.fast_forward !== false,
    time_multiplier,
    question_scope: value.question_scope ?? "all",
    bots: Array.isArray(value.bots) ? value.bots : [],
  };
}

export function expandProfiles(input: BotProfile[] | "random", count: number): BotProfile[] {
  if (input === "random") return Array.from({ length: count }, () => "random");
  if (input.length === 0) return Array.from({ length: count }, () => "mixed");
  if (input.length === 1) return Array.from({ length: count }, () => input[0]);
  return Array.from({ length: count }, (_, index) => input[index % input.length]);
}

export function pickBotNames(count: number, used: string[] = []): string[] {
  const available = BOT_NAMES.filter((name) => !used.includes(name));
  const pool = available.length >= count ? available : [...BOT_NAMES];
  return pool.slice(0, count);
}

export function avatarFromName(name: string): string {
  const palette = ["#C9A227", "#4C8BF5", "#E07A3D", "#2A9D8F", "#9B5DE5", "#F4A261", "#E63946", "#457B9D"];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return palette[hash % palette.length];
}

function hash01(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function botDelayMs(botId: string, questionId: string, profile: BotProfile, speed = 1): number {
  const range = BOT_DELAY_MS[profile];
  const t = hash01(`${botId}:${questionId}:delay`);
  const raw = range.min + t * (range.max - range.min);
  return Math.max(250, Math.round(raw / Math.max(1, speed)));
}

export function botIsCorrect(botId: string, questionId: string, profile: BotProfile): boolean {
  return hash01(`${botId}:${questionId}:acc`) < BOT_ACCURACY[profile];
}

export function botChoiceKey(
  choices: Array<{ key: string }>,
  correctKey: string,
  botId: string,
  questionId: string,
  profile: BotProfile,
): string {
  const keys = choices.map((choice) => choice.key);
  if (keys.length === 0) return correctKey || "A";
  if (botIsCorrect(botId, questionId, profile)) {
    return keys.find((key) => key.toUpperCase() === correctKey.toUpperCase()) ?? keys[0];
  }
  const wrong = keys.filter((key) => key.toUpperCase() !== correctKey.toUpperCase());
  if (wrong.length === 0) return keys[0];
  const index = Math.floor(hash01(`${botId}:${questionId}:wrong`) * wrong.length);
  return wrong[index];
}

export function sliceQuestionIds(ids: string[], scope: QuestionScope): string[] {
  if (scope === "all") return ids;
  if (scope === "first_5") return ids.slice(0, 5);
  const from = Math.max(1, scope.from);
  const to = Math.max(from, scope.to);
  return ids.slice(from - 1, to);
}

export function rehearsalTimePerQ(original: number, fastForward: boolean): number {
  if (!fastForward) return original;
  return Math.min(original, 5);
}

export function rehearsalRapidTotal(original: number, fastForward: boolean): number {
  if (!fastForward) return original;
  return Math.max(8, Math.min(original, 15));
}
