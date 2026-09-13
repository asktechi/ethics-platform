import { requireUser } from "@/lib/data/auth";
import { listQuestions, type QuestionFilters, type QuestionRow } from "@/lib/data/questions";
import { loadHostQuestions } from "@/lib/data/quiz";
import { randomJoinCode } from "@/lib/quiz/codes";
import type { QuizHostQuestion, QuizSettings } from "@/lib/quiz/types";
import {
  defaultGameSettings,
  type GameFilter,
  type GameMode,
  type GameSettings,
  type SettingsSnapshot,
  type WizardState,
} from "@/lib/games/types";
import type { Json } from "@/types/db";

function asSettings(value: Json | null | undefined): GameSettings {
  const raw = (value ?? {}) as Partial<GameSettings>;
  return { ...defaultGameSettings(), ...raw };
}

function asFilter(value: Json | null | undefined): GameFilter {
  const raw = (value ?? {}) as Partial<GameFilter>;
  return {
    standards: raw.standards ?? [],
    concepts: raw.concepts ?? [],
    difficulty: raw.difficulty ?? [],
    sources: raw.sources ?? [],
    approved_only: raw.approved_only ?? true,
  };
}

export function filterToQuestionFilters(filter: GameFilter): QuestionFilters {
  return {
    standardIds: filter.standards.length ? filter.standards : undefined,
    conceptIds: filter.concepts.length ? filter.concepts : undefined,
    difficulty: filter.difficulty.length ? filter.difficulty : undefined,
    sources: filter.sources.length ? filter.sources : undefined,
    status: filter.approved_only ? "approved" : "all",
  };
}

function shuffleIds(ids: string[]) {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export type GameTemplateRow = {
  id: string;
  class_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  tags: string[];
  mode: GameMode;
  pool_id: string | null;
  filter_json: GameFilter;
  settings_json: GameSettings;
  version: number;
  play_count: number;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  pool_name?: string | null;
  pool_count?: number | null;
  class_title?: string | null;
  standard_ids?: string[];
  difficulties?: Array<"easy" | "medium" | "hard">;
};

export type GameInstanceRow = {
  id: string;
  template_id: string;
  template_version: number;
  host_id: string;
  quiz_session_id: string | null;
  join_code: string;
  host_token: string;
  status: "scheduled" | "lobby" | "live" | "ended" | "abandoned";
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
  avg_score: number | null;
  duration_seconds: number | null;
  settings_snapshot: SettingsSnapshot;
  created_at: string;
  template_name?: string;
  top_scorer?: string | null;
};

function mapTemplate(row: Record<string, unknown>): GameTemplateRow {
  const pool = row.pool as { name?: string; question_pool_items?: Array<{ count?: number }> } | null;
  return {
    id: row.id as string,
    class_id: row.class_id as string,
    owner_id: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    mode: row.mode as GameMode,
    pool_id: (row.pool_id as string | null) ?? null,
    filter_json: asFilter(row.filter_json as Json),
    settings_json: asSettings(row.settings_json as Json),
    version: Number(row.version ?? 1),
    play_count: Number(row.play_count ?? 0),
    last_played_at: (row.last_played_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
    pool_name: pool?.name ?? null,
    class_title: (row.class as { title?: string } | null)?.title ?? null,
  };
}

export async function listGameTemplates(options: { includeArchived?: boolean } = {}) {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("game_templates")
    .select("*, pool:question_pools(name), class:classes(title)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  if (!options.includeArchived) query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapTemplate(row as Record<string, unknown>));
  const poolIds = rows.map((row) => row.pool_id).filter((id): id is string => Boolean(id));
  const { data: poolMeta } = poolIds.length
    ? await supabase
        .from("question_pool_items")
        .select("pool_id, question:questions(standard_id, difficulty)")
        .in("pool_id", poolIds)
    : { data: [] };
  const counts = new Map<string, number>();
  (poolMeta ?? []).forEach((item) => counts.set(item.pool_id, (counts.get(item.pool_id) ?? 0) + 1));
  const poolStandards = new Map<string, Set<string>>();
  const poolDifficulties = new Map<string, Set<"easy" | "medium" | "hard">>();
  (poolMeta ?? []).forEach((item) => {
    const raw = item.question as
      | { standard_id?: string | null; difficulty?: "easy" | "medium" | "hard" | null }
      | Array<{ standard_id?: string | null; difficulty?: "easy" | "medium" | "hard" | null }>
      | null;
    const question = Array.isArray(raw) ? raw[0] : raw;
    if (!item.pool_id) return;
    if (question?.standard_id) {
      const set = poolStandards.get(item.pool_id) ?? new Set<string>();
      set.add(question.standard_id);
      poolStandards.set(item.pool_id, set);
    }
    if (question?.difficulty) {
      const set = poolDifficulties.get(item.pool_id) ?? new Set<"easy" | "medium" | "hard">();
      set.add(question.difficulty);
      poolDifficulties.set(item.pool_id, set);
    }
  });

  return rows.map((row) => ({
    ...row,
    pool_count: row.pool_id ? (counts.get(row.pool_id) ?? 0) : null,
    standard_ids: row.pool_id
      ? [...(poolStandards.get(row.pool_id) ?? [])]
      : row.filter_json.standards,
    difficulties: row.pool_id
      ? [...(poolDifficulties.get(row.pool_id) ?? [])]
      : row.filter_json.difficulty,
  }));
}

export async function listGameTags() {
  const templates = await listGameTemplates({ includeArchived: true });
  return [...new Set(templates.flatMap((row) => row.tags))].sort();
}

export async function getGameTemplate(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_templates")
    .select("*, pool:question_pools(name), class:classes(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.owner_id !== user.id) throw new Error("Game not found.");
  return mapTemplate(data as Record<string, unknown>);
}

export async function createGameTemplate(input: WizardState) {
  const { supabase, user } = await requireUser();
  if (!input.name.trim()) throw new Error("Name is required.");
  if (!input.classId) throw new Error("Pick a class.");
  const { data, error } = await supabase
    .from("game_templates")
    .insert({
      class_id: input.classId,
      owner_id: user.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      tags: input.tags,
      mode: input.mode,
      pool_id: input.source === "pool" ? input.poolId || null : null,
      filter_json: input.source === "filter" ? input.filter : {},
      settings_json: input.settings,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateGameTemplate(id: string, input: Partial<WizardState> & { bumpVersion?: boolean }) {
  const current = await getGameTemplate(id);
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("game_templates")
    .update({
      name: input.name?.trim() ?? current.name,
      description: input.description !== undefined ? input.description.trim() || null : current.description,
      tags: input.tags ?? current.tags,
      mode: input.mode ?? current.mode,
      pool_id: input.source === "filter" ? null : input.poolId ?? current.pool_id,
      filter_json: input.filter ?? current.filter_json,
      settings_json: input.settings ?? current.settings_json,
      class_id: input.classId ?? current.class_id,
      version: (input.bumpVersion ?? true) ? current.version + 1 : current.version,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function archiveGameTemplate(id: string, restore = false) {
  await getGameTemplate(id);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("game_templates")
    .update({ deleted_at: restore ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloneGameTemplate(id: string) {
  const current = await getGameTemplate(id);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_templates")
    .insert({
      class_id: current.class_id,
      owner_id: user.id,
      name: `${current.name} copy`,
      description: current.description,
      tags: current.tags,
      mode: current.mode,
      pool_id: current.pool_id,
      filter_json: current.filter_json,
      settings_json: current.settings_json,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function resolveTemplateQuestions(template: GameTemplateRow): Promise<QuizHostQuestion[]> {
  if (template.pool_id) return loadHostQuestions(template.pool_id);
  const rows = await listQuestions(template.class_id, filterToQuestionFilters(template.filter_json));
  return rows.map(questionToHost);
}

function questionToHost(row: QuestionRow): QuizHostQuestion {
  return {
    question_id: row.id,
    stem: row.stem,
    choices: row.choices_json ?? [],
    answer_key: row.answer_key ?? "",
    explanation: row.explanation ?? "",
    time_limit_seconds: 30,
  };
}

export async function loadQuestionsByIds(ids: string[]): Promise<QuizHostQuestion[]> {
  if (ids.length === 0) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("questions")
    .select("id, stem, choices_json, answer_key, explanation")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({
      question_id: row!.id,
      stem: row!.stem,
      choices: (Array.isArray(row!.choices_json) ? row!.choices_json : []) as QuizHostQuestion["choices"],
      answer_key: row!.answer_key ?? "",
      explanation: row!.explanation ?? "",
      time_limit_seconds: 30,
    }));
}

export async function countFilterMatches(classId: string, filter: GameFilter) {
  const { countQuestions } = await import("@/lib/data/questions");
  return countQuestions(classId, filterToQuestionFilters(filter));
}

export async function listTemplateInstances(templateId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_instances")
    .select("*")
    .eq("template_id", templateId)
    .eq("host_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const sessionIds = (data ?? [])
    .map((row) => row.quiz_session_id)
    .filter((id): id is string => Boolean(id));
  const { data: players } = sessionIds.length
    ? await supabase
        .from("quiz_participants")
        .select("session_id, display_name, score")
        .in("session_id", sessionIds)
        .is("deleted_at", null)
    : { data: [] };
  const topBySession = new Map<string, { name: string; score: number }>();
  (players ?? []).forEach((player) => {
    const current = topBySession.get(player.session_id);
    if (!current || player.score > current.score) {
      topBySession.set(player.session_id, { name: player.display_name, score: player.score });
    }
  });
  return (data ?? []).map((row) => ({
    ...row,
    settings_snapshot: (row.settings_snapshot ?? {}) as SettingsSnapshot,
    top_scorer: row.quiz_session_id ? (topBySession.get(row.quiz_session_id)?.name ?? null) : null,
  })) as GameInstanceRow[];
}

export async function getGameInstance(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_instances")
    .select("*, template:game_templates(name, class_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.host_id !== user.id) throw new Error("Session not found.");
  const template = data.template as { name?: string } | null;
  return {
    ...(data as unknown as GameInstanceRow),
    settings_snapshot: (data.settings_snapshot ?? {}) as SettingsSnapshot,
    template_name: template?.name ?? "Game",
  };
}

export async function listRecentEndedInstances(limit = 5) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_instances")
    .select("*, template:game_templates(name)")
    .eq("host_id", user.id)
    .eq("status", "ended")
    .is("deleted_at", null)
    .order("ended_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as unknown as GameInstanceRow),
    template_name: (row.template as { name?: string } | null)?.name ?? "Game",
    settings_snapshot: (row.settings_snapshot ?? {}) as SettingsSnapshot,
  }));
}

export async function listUpcomingInstances() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("game_instances")
    .select("*, template:game_templates(name)")
    .eq("host_id", user.id)
    .eq("status", "scheduled")
    .is("deleted_at", null)
    .gt("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as unknown as GameInstanceRow),
    template_name: (row.template as { name?: string } | null)?.name ?? "Game",
    settings_snapshot: (row.settings_snapshot ?? {}) as SettingsSnapshot,
  }));
}

export async function scheduleGameInstance(templateId: string, when: string) {
  const template = await getGameTemplate(templateId);
  const { supabase, user } = await requireUser();
  const questions = await resolveTemplateQuestions(template);
  const questionIds = questions.map((item) => item.question_id);
  let joinCode = randomJoinCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("game_instances")
      .insert({
        template_id: template.id,
        template_version: template.version,
        host_id: user.id,
        join_code: joinCode,
        status: "scheduled",
        scheduled_for: when,
        settings_snapshot: {
          settings: template.settings_json,
          time_per_q: template.settings_json.time_per_q,
          mode: template.mode,
          question_ids: questionIds,
          pool_id: template.pool_id,
          filter: template.filter_json,
          name: template.name,
        } satisfies SettingsSnapshot,
      })
      .select("*")
      .single();
    if (!error && data) return data;
    joinCode = randomJoinCode();
  }
  throw new Error("Could not schedule the game.");
}

export async function launchGameFromTemplate(templateId: string) {
  const template = await getGameTemplate(templateId);
  if (template.mode !== "jeopardy") {
    throw new Error("This mode is coming in Phase 6D.");
  }
  const questions = await resolveTemplateQuestions(template);
  if (questions.length === 0) throw new Error("This game has no questions yet.");
  const settings = template.settings_json;
  const questionIds = settings.shuffle_questions
    ? shuffleIds(questions.map((item) => item.question_id))
    : questions.map((item) => item.question_id);

  const { supabase, user } = await requireUser();
  const hostToken = crypto.randomUUID();
  const snapshot: SettingsSnapshot = {
    settings,
    time_per_q: settings.time_per_q,
    mode: template.mode,
    question_ids: questionIds,
    pool_id: template.pool_id,
    filter: template.filter_json,
    name: template.name,
  };

  const quizSettings: QuizSettings = {
    allow_late_join: settings.allow_late_join,
    show_leaderboard: settings.show_leaderboard_to_players,
    show_correct_answer: settings.show_correct_answer_after,
    shuffle: settings.shuffle_questions,
    question_ids: questionIds,
    host_token: hostToken,
  };

  let session = null;
  let lastError = "Could not create a unique join code.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = randomJoinCode();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .insert({
        pool_id: template.pool_id,
        host_id: user.id,
        mode: "jeopardy",
        time_per_q: settings.time_per_q,
        status: "live",
        join_code: joinCode,
        current_question_index: 0,
        started_at: new Date().toISOString(),
        reveal_answer: false,
        settings_json: quizSettings,
      })
      .select("*")
      .single();
    if (!error && data) {
      session = data;
      const { error: instanceError } = await supabase.from("game_instances").insert({
        template_id: template.id,
        template_version: template.version,
        host_id: user.id,
        quiz_session_id: session.id,
        join_code: joinCode,
        host_token: hostToken,
        status: "lobby",
        started_at: new Date().toISOString(),
        settings_snapshot: snapshot as unknown as Json,
      });
      if (instanceError) throw new Error(instanceError.message);
      break;
    }
    lastError = error?.message ?? lastError;
  }
  if (!session) throw new Error(lastError);
  return session;
}

export async function loadWizardContext() {
  const { listRecentClasses } = await import("@/lib/data/classes");
  const { listPools } = await import("@/lib/data/question-pools");
  const { listStandards } = await import("@/lib/data/standards");
  const { listConceptsByClass } = await import("@/lib/data/concepts");
  const { supabase } = await requireUser();
  const classes = await listRecentClasses(50);
  const standards = await listStandards();
  const poolsByClass: Record<string, Array<{ id: string; name: string; count: number; stems: string[] }>> = {};
  const conceptsByClass: Record<string, Array<{ id: string; title: string }>> = {};
  for (const klass of classes) {
    const [pools, concepts] = await Promise.all([listPools(klass.id), listConceptsByClass(klass.id)]);
    const ids = pools.map((pool) => pool.id);
    const { data: items } = ids.length
      ? await supabase
          .from("question_pool_items")
          .select("pool_id, question:questions(stem)")
          .in("pool_id", ids)
      : { data: [] };
    const grouped = new Map<string, string[]>();
    (items ?? []).forEach((item) => {
      const raw = item.question as { stem?: string } | Array<{ stem?: string }> | null;
      const question = Array.isArray(raw) ? raw[0] : raw;
      const list = grouped.get(item.pool_id) ?? [];
      if (question?.stem) list.push(question.stem);
      grouped.set(item.pool_id, list);
    });
    poolsByClass[klass.id] = pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      count: grouped.get(pool.id)?.length ?? 0,
      stems: (grouped.get(pool.id) ?? []).slice(0, 3),
    }));
    conceptsByClass[klass.id] = concepts.map((item) => ({ id: item.id, title: item.title }));
  }
  return {
    classes: classes.map((item) => ({ id: item.id, title: item.title })),
    poolsByClass,
    standards: standards.map((item) => ({ id: item.id, code: item.code, title: item.title })),
    conceptsByClass,
  };
}

export async function coverageForQuestions(questions: Array<{ question_id?: string; id?: string }>, classId: string) {
  const ids = questions.map((item) => item.question_id ?? item.id).filter(Boolean) as string[];
  if (ids.length === 0) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("questions")
    .select("standard_id, standard:standards(code, title)")
    .eq("class_id", classId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const tally = new Map<string, { code: string; title: string; count: number }>();
  (data ?? []).forEach((row) => {
    const standard = row.standard as { code?: string; title?: string } | null;
    const key = row.standard_id ?? "untagged";
    const current = tally.get(key) ?? {
      code: standard?.code ?? "—",
      title: standard?.title ?? "Untagged",
      count: 0,
    };
    current.count += 1;
    tally.set(key, current);
  });
  return [...tally.values()].sort((a, b) => b.count - a.count);
}
