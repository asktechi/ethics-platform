import { requireUser } from "@/lib/data/auth";
import { randomJoinCode } from "@/lib/quiz/codes";
import type { QuizChoice, QuizHostQuestion, QuizMode, QuizSettings } from "@/lib/quiz/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db";

type PoolQuestionRow = {
  question_id: string;
  stem: string;
  choices_json: Json;
  answer_key: string | null;
  explanation: string | null;
};

function asChoices(value: Json): QuizChoice[] {
  return Array.isArray(value) ? (value as QuizChoice[]) : [];
}

export type LaunchInput = {
  classId: string;
  poolId: string;
  mode: QuizMode;
  timePerQ: number;
  shuffle: boolean;
  allowLateJoin: boolean;
  showLeaderboard: boolean;
  showCorrectAnswer: boolean;
};

function shuffleIds(ids: string[]) {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export async function loadHostQuestions(poolId: string): Promise<QuizHostQuestion[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("load_pool_questions", { p_pool_id: poolId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PoolQuestionRow[]).map((row) => ({
    question_id: row.question_id,
    stem: row.stem,
    choices: asChoices(row.choices_json),
    answer_key: row.answer_key ?? "",
    explanation: row.explanation ?? "",
    time_limit_seconds: 30,
  }));
}

export async function launchQuizSession(input: LaunchInput) {
  const { supabase, user } = await requireUser();
  const questions = await loadHostQuestions(input.poolId);
  if (questions.length === 0) {
    throw new Error("This pool has no approved questions.");
  }
  const questionIds = input.shuffle
    ? shuffleIds(questions.map((item) => item.question_id))
    : questions.map((item) => item.question_id);

  const settings: QuizSettings = {
    allow_late_join: input.allowLateJoin,
    show_leaderboard: input.showLeaderboard,
    show_correct_answer: input.showCorrectAnswer,
    shuffle: input.shuffle,
    question_ids: questionIds,
  };

  let session = null;
  let lastError = "Could not create a unique join code.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = randomJoinCode();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .insert({
        pool_id: input.poolId,
        host_id: user.id,
        mode: input.mode,
        time_per_q: input.timePerQ,
        status: "live",
        join_code: joinCode,
        current_question_index: 0,
        started_at: new Date().toISOString(),
        reveal_answer: false,
        settings_json: settings,
      })
      .select("*")
      .single();
    if (!error && data) {
      session = data;
      break;
    }
    lastError = error?.message ?? lastError;
  }
  if (!session) throw new Error(lastError);
  return session;
}

export async function getHostSession(sessionId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("*, pool:question_pools(id, name, class_id)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.host_id !== user.id) throw new Error("Session not found.");
  return data;
}

export async function getPublicSession(sessionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quiz_sessions")
    .select("id, pool_id, status, join_code, time_per_q, current_question_index, settings_json, mode")
    .eq("id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Session not found.");
  return data;
}

export async function getPublicPlayContext(sessionId: string) {
  const session = await getPublicSession(sessionId);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("load_pool_questions", { p_pool_id: session.pool_id });
  if (error) throw new Error(error.message);

  const settings = (session.settings_json ?? {}) as QuizSettings;
  const rows = (data ?? []) as PoolQuestionRow[];
  const byId = new Map(rows.map((row) => [row.question_id, row]));
  const orderedIds = settings.question_ids?.length ? settings.question_ids : rows.map((row) => row.question_id);
  const currentRow = byId.get(orderedIds[session.current_question_index] ?? "");

  return {
    session,
    questionCount: orderedIds.length,
    currentQuestion: currentRow
      ? {
          question_id: currentRow.question_id,
          stem: currentRow.stem,
          choices: asChoices(currentRow.choices_json),
          time_limit_seconds: session.time_per_q ?? 30,
        }
      : null,
  };
}
