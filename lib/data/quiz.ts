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
    host_token: crypto.randomUUID(),
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

  const { data: pool } = await supabase
    .from("question_pools")
    .select("class_id, name")
    .eq("id", input.poolId)
    .maybeSingle();
  if (pool?.class_id) {
    const { data: template } = await supabase
      .from("game_templates")
      .insert({
        class_id: pool.class_id,
        owner_id: user.id,
        name: `${pool.name} (auto)`,
        description: "Created from the pool launcher.",
        tags: ["auto"],
        mode: "jeopardy",
        pool_id: input.poolId,
        settings_json: {
          time_per_q: input.timePerQ,
          base_points: 100,
          time_bonus: true,
          streak_bonus: true,
          shuffle_questions: input.shuffle,
          show_leaderboard_to_players: input.showLeaderboard,
          show_correct_answer_after: input.showCorrectAnswer,
          allow_late_join: input.allowLateJoin,
          allow_audience_advance: false,
        },
      })
      .select("id, version")
      .single();
    if (template) {
      await supabase.from("game_instances").insert({
        template_id: template.id,
        template_version: template.version,
        host_id: user.id,
        quiz_session_id: session.id,
        join_code: session.join_code,
        host_token: settings.host_token,
        status: "lobby",
        started_at: session.started_at,
        settings_snapshot: {
          settings: settings,
          time_per_q: input.timePerQ,
          mode: "jeopardy",
          question_ids: questionIds,
          pool_id: input.poolId,
          name: pool.name,
        },
      });
    }
  }
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
  const settings = (data.settings_json ?? {}) as QuizSettings;
  if (!settings.host_token) {
    const host_token = crypto.randomUUID();
    const next = { ...settings, host_token };
    const { error: tokenError } = await supabase
      .from("quiz_sessions")
      .update({ settings_json: next as unknown as Json })
      .eq("id", sessionId);
    if (tokenError) throw new Error(tokenError.message);
    return { ...data, settings_json: next as unknown as Json };
  }
  return data;
}

export async function getPublicSession(sessionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quiz_sessions")
    .select("id, pool_id, host_id, status, join_code, time_per_q, current_question_index, reveal_answer, settings_json, mode, ended_at, started_at")
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
  const settings = (session.settings_json ?? {}) as QuizSettings;
  const ids = settings.question_ids ?? [];
  let rows: PoolQuestionRow[] = [];
  if (session.pool_id) {
    const { data, error } = await admin.rpc("load_pool_questions", { p_pool_id: session.pool_id });
    if (error) throw new Error(error.message);
    rows = (data ?? []) as PoolQuestionRow[];
  }
  if (ids.length) {
    const { data, error } = await admin
      .from("questions")
      .select("id, stem, choices_json, answer_key, explanation")
      .in("id", ids);
    if (error) throw new Error(error.message);
    rows = ((data ?? []) as Array<{
      id: string;
      stem: string;
      choices_json: Json;
      answer_key: string | null;
      explanation: string | null;
    }>).map((row) => ({
      question_id: row.id,
      stem: row.stem,
      choices_json: row.choices_json,
      answer_key: row.answer_key,
      explanation: row.explanation,
    }));
  }
  const byId = new Map(rows.map((row) => [row.question_id, row]));
  const orderedIds = ids.length ? ids : rows.map((row) => row.question_id);
  const currentRow = byId.get(orderedIds[session.current_question_index] ?? "");
  const playQuestions = orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({
      question_id: row!.question_id,
      stem: row!.stem,
      choices: asChoices(row!.choices_json),
      time_limit_seconds: session.time_per_q ?? 30,
    }));

  const { data: instance } = await admin
    .from("game_instances")
    .select("id, team_assignment_mode")
    .eq("quiz_session_id", session.id)
    .is("deleted_at", null)
    .maybeSingle();
  const { data: teams } = instance?.id
    ? await admin.from("game_teams").select("id, instance_id, team_key, name, color, created_at").eq("instance_id", instance.id)
    : { data: [] };

  return {
    session,
    questionCount: orderedIds.length,
    hostId: session.host_id,
    playQuestions,
    teams: teams ?? [],
    teamAssignmentMode: instance?.team_assignment_mode ?? "auto",
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

export async function listSessionTeams(sessionId: string) {
  const { supabase } = await requireUser();
  const { data: instance, error: instanceError } = await supabase
    .from("game_instances")
    .select("id")
    .eq("quiz_session_id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (instanceError) throw new Error(instanceError.message);
  if (!instance) return [];
  const { data, error } = await supabase
    .from("game_teams")
    .select("id, instance_id, team_key, name, color, created_at")
    .eq("instance_id", instance.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSessionParticipants(sessionId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("quiz_participants")
    .select("id, display_name, score, streak, avatar_color, connected, last_correct_at, joined_at, team_id, team_role")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSessionResponses(sessionId: string, questionId?: string) {
  const { supabase } = await requireUser();
  let query = supabase
    .from("quiz_responses")
    .select("id, participant_id, question_id, choice_key, answer, ms_taken, is_correct, submitted_at")
    .eq("session_id", sessionId)
    .is("deleted_at", null);
  if (questionId) query = query.eq("question_id", questionId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSessionReport(sessionId: string) {
  const session = await getHostSession(sessionId);
  const [participants, responses, teams] = await Promise.all([
    listSessionParticipants(sessionId),
    listSessionResponses(sessionId),
    listSessionTeams(sessionId),
  ]);
  const settings = (session.settings_json ?? {}) as QuizSettings;
  const questions = session.pool_id
    ? await loadHostQuestions(session.pool_id)
    : await (await import("@/lib/data/games")).loadQuestionsByIds(settings.question_ids ?? []);
  const ordered = (settings.question_ids ?? questions.map((item) => item.question_id))
    .map((id) => questions.find((item) => item.question_id === id))
    .filter(Boolean) as QuizHostQuestion[];
  const pool = session.pool as { id?: string; name?: string; class_id?: string } | null;
  return { session, participants, responses, questions: ordered, pool, teams };
}
