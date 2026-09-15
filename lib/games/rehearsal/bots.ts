import type { SupabaseClient } from "@supabase/supabase-js";
import {
  avatarFromName,
  botChoiceKey,
  botDelayMs,
  expandProfiles,
  parseRehearsalConfig,
  pickBotNames,
  type BotProfile,
  type RehearsalBotRecord,
  type RehearsalConfig,
} from "@/lib/games/rehearsal/types";

export type TickQuestion = {
  question_id: string;
  answer_key: string;
  choices: Array<{ key: string; text?: string }>;
};

export type TickResult = {
  submitted: number;
  skipped: number;
  errors: string[];
};

function profileForBot(config: RehearsalConfig, bot: RehearsalBotRecord): BotProfile {
  return bot.profile;
}

export async function insertRehearsalBots(
  admin: SupabaseClient,
  sessionId: string,
  instanceId: string,
  config: RehearsalConfig,
  extraCount = 0,
): Promise<RehearsalBotRecord[]> {
  const existing = config.bots ?? [];
  const add = extraCount > 0 ? extraCount : Math.max(0, config.bot_count - existing.length);
  if (add <= 0) return existing;
  const used = existing.map((bot) => bot.display_name);
  const names = pickBotNames(add, used);
  const profiles = extraCount > 0 ? Array.from({ length: add }, () => "mixed" as const) : expandProfiles(config.bot_profiles, add);
  const created: RehearsalBotRecord[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const display_name = names[index];
    const profile = profiles[index] ?? "mixed";
    const avatar_color = avatarFromName(display_name);
    const participant_token = crypto.randomUUID();
    const { data, error } = await admin
      .from("quiz_participants")
      .insert({
        session_id: sessionId,
        display_name,
        participant_token,
        avatar_color,
        connected: true,
        is_bot: true,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not insert rehearsal bot.");
    created.push({
      participant_id: data.id,
      display_name,
      profile,
      participant_token,
      avatar_color,
    });
  }
  const bots = [...existing, ...created];
  const next: RehearsalConfig = {
    ...config,
    bot_count: bots.length,
    bots,
  };
  const { error: updateError } = await admin
    .from("game_instances")
    .update({ rehearsal_config: next })
    .eq("id", instanceId);
  if (updateError) throw new Error(updateError.message);
  return bots;
}

export async function runRehearsalTick(
  admin: SupabaseClient,
  sessionId: string,
  opts: {
    now?: number;
    questions: TickQuestion[];
    mode: string;
  },
): Promise<TickResult> {
  const result: TickResult = { submitted: 0, skipped: 0, errors: [] };
  const { data: instance, error: instanceError } = await admin
    .from("game_instances")
    .select("id, is_rehearsal, rehearsal_config")
    .eq("quiz_session_id", sessionId)
    .eq("is_rehearsal", true)
    .maybeSingle();
  if (instanceError) throw new Error(instanceError.message);
  if (!instance) return result;

  const config = parseRehearsalConfig(instance.rehearsal_config);
  const bots = config.bots ?? [];
  if (bots.length === 0) return result;

  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .select("id, status, mode, current_question_index, reveal_answer, settings_json, time_per_q")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.status !== "live") return result;

  const settings = (session.settings_json ?? {}) as {
    question_started_at?: string | null;
    paused_at?: string | null;
    game_started_at?: string | null;
    question_ids?: string[];
  };
  if (settings.paused_at) return result;

  const { data: responses } = await admin
    .from("quiz_responses")
    .select("participant_id, question_id")
    .eq("session_id", sessionId)
    .is("deleted_at", null);
  const answered = new Set(
    (responses ?? []).map((row) => `${row.participant_id}:${row.question_id}`),
  );

  const now = opts.now ?? Date.now();
  const speed = config.time_multiplier || 1;
  const mode = opts.mode || session.mode || "jeopardy";
  const independent = mode === "rapid_fire" || mode === "adaptive";

  const current = opts.questions[session.current_question_index ?? 0];
  const questionStarted = settings.question_started_at
    ? Date.parse(settings.question_started_at)
    : settings.game_started_at
      ? Date.parse(settings.game_started_at)
      : NaN;

  for (const bot of bots) {
    const profile = profileForBot(config, bot);
    const targets: TickQuestion[] = independent
      ? opts.questions.filter((question) => !answered.has(`${bot.participant_id}:${question.question_id}`)).slice(0, 1)
      : current
        ? [current]
        : [];
    for (const question of targets) {
      if (!question) continue;
      if (answered.has(`${bot.participant_id}:${question.question_id}`)) {
        result.skipped += 1;
        continue;
      }
      if (!independent && session.reveal_answer) {
        result.skipped += 1;
        continue;
      }
      const startMs = Number.isFinite(questionStarted)
        ? questionStarted
        : now;
      const delay = botDelayMs(bot.participant_id, question.question_id, profile, speed);
      if (now < startMs + delay) continue;
      const choice = botChoiceKey(
        question.choices,
        question.answer_key,
        bot.participant_id,
        question.question_id,
        profile,
      );
      const msTaken = Math.max(200, Math.min(delay, now - startMs));
      const { error } = await admin.rpc("submit_answer", {
        p_participant_token: bot.participant_token,
        p_question_id: question.question_id,
        p_choice_key: choice,
        p_ms_taken: Math.round(msTaken),
      });
      if (error) {
        result.errors.push(`${bot.display_name}: ${error.message}`);
        continue;
      }
      result.submitted += 1;
      answered.add(`${bot.participant_id}:${question.question_id}`);
    }
  }
  return result;
}
