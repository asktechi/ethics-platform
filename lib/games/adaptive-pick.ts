export type AdaptiveQuestionCandidate = {
  id: string;
  standard_id: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  weakness_score: number;
  recent_correct: boolean;
  answered_count_for_standard: number;
};

export type AdaptivePickState = {
  answered_ids: string[];
  last_standard_id?: string | null;
  current_standard_id?: string | null;
  current_question_id?: string | null;
  streak: number;
  wrong_in_row: number;
};

export type AdaptivePickConfig = {
  total_questions: number;
  prefer_weak: boolean;
  avoid_recent_days: number;
  min_questions_per_standard: number;
  difficulty_ramp: boolean;
};

export function defaultAdaptiveConfig(): AdaptivePickConfig {
  return {
    total_questions: 15,
    prefer_weak: true,
    avoid_recent_days: 14,
    min_questions_per_standard: 2,
    difficulty_ramp: true,
  };
}

export function scoreAdaptiveCandidate(
  question: AdaptiveQuestionCandidate,
  config: AdaptivePickConfig,
  state: AdaptivePickState,
) {
  const weakness = config.prefer_weak ? question.weakness_score : 1 - question.weakness_score;
  let score = weakness * 10;
  if (question.answered_count_for_standard < config.min_questions_per_standard) score += 4;
  if (config.difficulty_ramp) {
    if (state.streak >= 3) {
      if (question.difficulty === "hard") score += 3;
      else if (question.difficulty === "medium") score += 1;
    }
    if (state.wrong_in_row >= 2) {
      if (question.difficulty === "easy") score += 3;
      else if (question.difficulty === "medium") score += 1;
    }
  }
  return score;
}

export function pickNextQuestionFromPool(
  pool: AdaptiveQuestionCandidate[],
  state: AdaptivePickState,
  config: AdaptivePickConfig,
  random = Math.random,
): string | null {
  if (state.current_question_id && !state.answered_ids.includes(state.current_question_id)) {
    return state.current_question_id;
  }
  if (state.answered_ids.length >= config.total_questions) return null;

  const remaining = pool.filter((question) => !state.answered_ids.includes(question.id));
  if (remaining.length === 0) return null;

  const withoutRecent = remaining.filter((question) => !question.recent_correct);
  const eligible = withoutRecent.length ? withoutRecent : remaining;
  const scored = eligible.map((question) => ({
    id: question.id,
    score: scoreAdaptiveCandidate(question, config, state),
  }));
  scored.sort((a, b) => b.score - a.score);
  const cutoffIndex = Math.max(0, Math.ceil(scored.length * 0.3) - 1);
  const threshold = scored[cutoffIndex]?.score ?? 0;
  const top = scored.filter((row) => row.score >= threshold);
  const weightSum = top.reduce((sum, row) => sum + row.score + 0.01, 0);
  let cursor = random() * weightSum;
  for (const row of top) {
    cursor -= row.score + 0.01;
    if (cursor <= 0) return row.id;
  }
  return top[0]?.id ?? null;
}
