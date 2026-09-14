import "server-only";
import {
  defaultAdaptiveConfig,
  pickNextQuestionFromPool,
  type AdaptivePickConfig,
  type AdaptivePickState,
  type AdaptiveQuestionCandidate,
} from "@/lib/games/adaptive-pick";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdaptivePlayQuestion = {
  question_id: string;
  stem: string;
  choices: Array<{ key: string; text: string }>;
  time_limit_seconds: number;
  standard_id: string | null;
  standard_code: string | null;
  standard_title: string | null;
  question_index: number;
  total_questions: number;
  finished: boolean;
};

type AdaptiveStateFile = {
  per_participant?: Record<string, AdaptivePickState & { hinted_ids?: string[] }>;
};

function asConfig(raw: Record<string, unknown> | null | undefined): AdaptivePickConfig {
  const defaults = defaultAdaptiveConfig();
  return {
    total_questions: Number(raw?.total_questions ?? defaults.total_questions),
    prefer_weak: raw?.prefer_weak !== false,
    avoid_recent_days: Number(raw?.avoid_recent_days ?? defaults.avoid_recent_days),
    min_questions_per_standard: Number(raw?.min_questions_per_standard ?? defaults.min_questions_per_standard),
    difficulty_ramp: raw?.difficulty_ramp !== false,
  };
}

export async function pickNextQuestion(sessionId: string, participantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: rpcId, error } = await admin.rpc("pick_next_adaptive_question", {
    p_session_id: sessionId,
    p_participant_id: participantId,
  });
  if (!error && (typeof rpcId === "string" || rpcId === null)) return rpcId;

  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Session not found");

  const settings = (session.settings_json ?? {}) as {
    question_ids?: string[];
    mode_config?: Record<string, unknown>;
  };
  const config = asConfig(settings.mode_config);
  const questionIds = settings.question_ids ?? [];
  const { data: instance } = await admin
    .from("game_instances")
    .select("id, adaptive_state")
    .eq("quiz_session_id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();
  const stateFile = (instance?.adaptive_state ?? {}) as AdaptiveStateFile;
  const part = stateFile.per_participant?.[participantId] ?? {
    answered_ids: [],
    streak: 0,
    wrong_in_row: 0,
  };

  const { data: participant } = await admin
    .from("quiz_participants")
    .select("student_profile_id")
    .eq("id", participantId)
    .maybeSingle();

  const { data: questions } = await admin
    .from("questions")
    .select("id, standard_id, difficulty")
    .in("id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"]);

  const cutoff = new Date(Date.now() - config.avoid_recent_days * 86400000).toISOString();
  const recentCorrect = new Set<string>();
  if (participant?.student_profile_id) {
    const { data: recent } = await admin
      .from("quiz_responses")
      .select("question_id, is_correct, submitted_at, participant:quiz_participants(student_profile_id)")
      .in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("is_correct", true)
      .gte("submitted_at", cutoff);
    for (const row of recent ?? []) {
      const profile = (row.participant as { student_profile_id?: string } | { student_profile_id?: string }[] | null);
      const id = Array.isArray(profile) ? profile[0]?.student_profile_id : profile?.student_profile_id;
      if (id === participant.student_profile_id) recentCorrect.add(row.question_id);
    }
  }

  const weakness = new Map<string, number>();
  if (participant?.student_profile_id) {
    const { data: perf } = await admin
      .from("student_performance")
      .select("standard_id, weakness_score")
      .eq("student_profile_id", participant.student_profile_id);
    for (const row of perf ?? []) weakness.set(row.standard_id, Number(row.weakness_score ?? 0));
  }

  const answeredSet = new Set(part.answered_ids);
  const stdCounts = new Map<string, number>();
  for (const question of questions ?? []) {
    if (!answeredSet.has(question.id) || !question.standard_id) continue;
    stdCounts.set(question.standard_id, (stdCounts.get(question.standard_id) ?? 0) + 1);
  }

  const pool: AdaptiveQuestionCandidate[] = (questions ?? []).map((question) => ({
    id: question.id,
    standard_id: question.standard_id,
    difficulty: question.difficulty,
    weakness_score: question.standard_id ? (weakness.get(question.standard_id) ?? 0.5) : 0.5,
    recent_correct: recentCorrect.has(question.id),
    answered_count_for_standard: question.standard_id ? (stdCounts.get(question.standard_id) ?? 0) : 0,
  }));

  return pickNextQuestionFromPool(pool, part, config);
}

export async function loadAdaptivePlayQuestion(
  sessionId: string,
  participantId: string,
): Promise<AdaptivePlayQuestion> {
  const admin = createAdminClient();
  const { data: session } = await admin.from("quiz_sessions").select("time_per_q, settings_json").eq("id", sessionId).maybeSingle();
  const config = asConfig(((session?.settings_json ?? {}) as { mode_config?: Record<string, unknown> }).mode_config);
  const questionId = await pickNextQuestion(sessionId, participantId);
  const { data: instance } = await admin
    .from("game_instances")
    .select("adaptive_state")
    .eq("quiz_session_id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();
  const part = ((instance?.adaptive_state ?? {}) as AdaptiveStateFile).per_participant?.[participantId];
  const answered = part?.answered_ids?.length ?? 0;
  if (!questionId) {
    return {
      question_id: "",
      stem: "",
      choices: [],
      time_limit_seconds: session?.time_per_q ?? 45,
      standard_id: null,
      standard_code: null,
      standard_title: null,
      question_index: answered,
      total_questions: config.total_questions,
      finished: true,
    };
  }
  const { data: rows } = await admin.rpc("get_adaptive_play_question", { p_question_id: questionId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  const choices = Array.isArray(row?.choices_json) ? row.choices_json : [];
  return {
    question_id: row?.question_id ?? questionId,
    stem: row?.stem ?? "",
    choices,
    time_limit_seconds: session?.time_per_q ?? 45,
    standard_id: row?.standard_id ?? null,
    standard_code: row?.standard_code ?? null,
    standard_title: row?.standard_title ?? null,
    question_index: answered,
    total_questions: config.total_questions,
    finished: false,
  };
}
