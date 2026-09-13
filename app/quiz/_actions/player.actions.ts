"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function lookupQuizAction(code: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("lookup_quiz_by_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, error: "No session uses that code." };
  return { ok: true as const, session: row };
}

export async function joinQuizAction(code: string, displayName: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_quiz", {
    p_join_code: code.trim().toUpperCase(),
    p_display_name: displayName.trim(),
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, error: "Could not join." };
  return { ok: true as const, join: row };
}

export async function submitAnswerAction(input: {
  token: string;
  questionId: string;
  choiceKey: string | null;
  msTaken: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_participant_token: input.token,
    p_question_id: input.questionId,
    p_choice_key: input.choiceKey,
    p_ms_taken: input.msTaken,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true as const,
    alreadyAnswered: Boolean(row?.already_answered),
  };
}

export async function myParticipantAction(token: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_participant_by_token", {
    p_token: token,
  });
  if (error) return { ok: false as const, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, error: "Player not found." };
  return { ok: true as const, participant: row };
}

export async function finalLeaderboardAction(sessionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_final_leaderboard", {
    p_session_id: sessionId,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}
