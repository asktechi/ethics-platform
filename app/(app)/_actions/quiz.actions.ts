"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "@/lib/data/errors";
import {
  getHostSession,
  getSessionReport,
  launchQuizSession,
  listSessionParticipants,
  listSessionResponses,
  listSessionTeams,
  loadHostQuestions,
} from "@/lib/data/quiz";
import { requireUser } from "@/lib/data/auth";

export async function launchQuizAction(input: unknown) {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      poolId: z.string().uuid(),
      mode: z.enum(["jeopardy", "standard", "rapid_fire", "team_battle"]),
      timePerQ: z.number().int().min(5).max(300),
      shuffle: z.boolean(),
      allowLateJoin: z.boolean(),
      showLeaderboard: z.boolean(),
      showCorrectAnswer: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid launch settings." };
  try {
    const session = await launchQuizSession(parsed.data);
    const settings = (session.settings_json ?? {}) as { host_token?: string };
    revalidatePath(`/class/${parsed.data.classId}/questions/pools`);
    return {
      ok: true as const,
      sessionId: session.id,
      joinCode: session.join_code,
      hostToken: settings.host_token ?? "",
    };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizSetQuestionAction(sessionId: string, index: number) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_set_question", {
      p_session_id: sessionId,
      p_index: index,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizRevealAction(sessionId: string, questionId: string, correctKey: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_apply_reveal", {
      p_session_id: sessionId,
      p_question_id: questionId,
      p_correct_key: correctKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizEndAction(sessionId: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_end_session", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
    await supabase.rpc("finalize_game_instance", { p_session_id: sessionId });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizPauseAction(sessionId: string, paused: boolean, remainingMs: number) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_set_pause", {
      p_session_id: sessionId,
      p_paused: paused,
      p_remaining_ms: remainingMs,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizSkipAction(sessionId: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_skip_question", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizSetConnectedAction(sessionId: string, onlineIds: string[]) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_set_connected", {
      p_session_id: sessionId,
      p_online_ids: onlineIds,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function quizReassignTeamAction(sessionId: string, participantId: string, teamKey: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("quiz_reassign_team", {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_team_key: teamKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function loadHostLiveAction(sessionId: string) {
  try {
    const [session, participants, responses, teams] = await Promise.all([
      getHostSession(sessionId),
      listSessionParticipants(sessionId),
      listSessionResponses(sessionId),
      listSessionTeams(sessionId),
    ]);
    return { ok: true as const, session, participants, responses, teams };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function loadSessionReportAction(sessionId: string) {
  try {
    return { ok: true as const, ...(await getSessionReport(sessionId)) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export async function loadHostQuestionsAction(poolId: string) {
  try {
    return { ok: true as const, questions: await loadHostQuestions(poolId) };
  } catch (error) {
    return { ok: false as const, error: actionError(error) };
  }
}

export { getHostSession };
