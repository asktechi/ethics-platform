"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import { requireUser } from "@/lib/data/auth";
import { launchGameFromTemplate } from "@/lib/data/games";
import { GameLaunchBlockedError } from "@/lib/games/resolve";
import { insertRehearsalBots } from "@/lib/games/rehearsal/bots";
import { parseRehearsalConfig, type BotProfile, type QuestionScope } from "@/lib/games/rehearsal/types";
import { createAdminClient } from "@/lib/supabase/admin";

const launchSchema = z.object({
  templateId: z.string().uuid(),
  bot_count: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)]),
  bot_profiles: z.union([
    z.literal("random"),
    z.array(z.enum(["perfect", "mixed", "struggler", "random"])).min(1),
  ]),
  fast_forward: z.boolean(),
  question_scope: z.union([
    z.literal("all"),
    z.literal("first_5"),
    z.object({ from: z.number().int().min(1), to: z.number().int().min(1) }),
  ]),
});

export async function startRehearsalAction(input: unknown) {
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid rehearsal settings." };
  try {
    const session = await launchGameFromTemplate(parsed.data.templateId, {
      bot_count: parsed.data.bot_count,
      bot_profiles: parsed.data.bot_profiles as BotProfile[] | "random",
      fast_forward: parsed.data.fast_forward,
      question_scope: parsed.data.question_scope as QuestionScope,
    });
    revalidatePath(`/games/${parsed.data.templateId}`);
    return { ok: true as const, sessionId: session.id, joinCode: session.join_code };
  } catch (error) {
    if (error instanceof GameLaunchBlockedError) {
      return { ok: false as const, error: error.message, cannotStart: true as const };
    }
    return { ok: false as const, error: actionError(error) };
  }
}

async function loadOwnedRehearsal(sessionId: string) {
  const { supabase, user } = await requireUser();
  const { data: instance, error } = await supabase
    .from("game_instances")
    .select("id, template_id, quiz_session_id, is_rehearsal, rehearsal_config, host_id")
    .eq("quiz_session_id", sessionId)
    .eq("host_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!instance?.is_rehearsal) throw new Error("This is not a rehearsal session.");
  return { supabase, user, instance };
}

export async function endRehearsalAction(sessionId: string) {
  try {
    const { instance } = await loadOwnedRehearsal(sessionId);
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("end_rehearsal", { p_instance_id: instance.id });
    if (error) throw new Error(error.message);
    revalidatePath(`/games/${instance.template_id}`);
    revalidatePath("/games");
    revalidatePath("/dashboard");
    return { ok: true as const, templateId: instance.template_id as string };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function restartRehearsalAction(sessionId: string) {
  try {
    const { instance } = await loadOwnedRehearsal(sessionId);
    const config = parseRehearsalConfig(instance.rehearsal_config);
    const templateId = instance.template_id as string;
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("end_rehearsal", { p_instance_id: instance.id });
    if (error) throw new Error(error.message);
    const botCount = config.bot_count === 10 || config.bot_count === 5 || config.bot_count === 1 ? config.bot_count : 3;
    const session = await launchGameFromTemplate(templateId, {
      bot_count: botCount,
      bot_profiles: config.bot_profiles,
      fast_forward: config.fast_forward,
      question_scope: config.question_scope,
    });
    return { ok: true as const, sessionId: session.id, templateId };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function addRehearsalBotAction(sessionId: string) {
  try {
    const { instance } = await loadOwnedRehearsal(sessionId);
    const config = parseRehearsalConfig(instance.rehearsal_config);
    await insertRehearsalBots(
      createAdminClient(),
      instance.quiz_session_id as string,
      instance.id,
      config,
      1,
    );
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function setRehearsalSpeedAction(sessionId: string, speed: 1 | 2 | 4) {
  try {
    const { instance, supabase } = await loadOwnedRehearsal(sessionId);
    const config = parseRehearsalConfig(instance.rehearsal_config);
    const { error } = await supabase
      .from("game_instances")
      .update({ rehearsal_config: { ...config, time_multiplier: speed } })
      .eq("id", instance.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, speed };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}
