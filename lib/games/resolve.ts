import type { GameFilter, GameMode } from "@/lib/games/types";

export type FilterShape = {
  standards: string[];
  concepts: string[];
  difficulty: string[];
  sources: string[];
  approved_only: boolean;
  search?: string;
};

export type GameTemplate = {
  class_id: string;
  pool_id?: string | null;
  filter_json?: FilterShape | GameFilter | null;
  mode?: GameMode | string | null;
  case_study_ids?: string[] | null;
};

export type ResolvedGameQuestion = {
  id: string;
  stem: string;
  choices_json: unknown;
  answer_key: string | null;
  explanation: string | null;
  standard_id: string | null;
  concept_id: string | null;
  difficulty: string | null;
  source: string | null;
  approved: boolean;
};

export type ResolveDiagnostics = {
  poolItemCount: number;
  approvedCount: number;
  filterMatchCount: number;
  missingPool: boolean;
  emptyPool: boolean;
  noMatchingQuestions: boolean;
};

export type ResolveGameResult = {
  questionIds: string[];
  questions: ResolvedGameQuestion[];
  source: "pool" | "filter";
  poolId: string | null;
  filterUsed: FilterShape | null;
  diagnostics: ResolveDiagnostics;
};

type QueryResult = { data: unknown; error: { message: string } | null };
type QueryChain = {
  select: (columns: string) => QueryChain;
  eq: (column: string, value: unknown) => QueryChain;
  in: (column: string, value: unknown[]) => QueryChain;
  is: (column: string, value: unknown) => QueryChain;
  ilike: (column: string, value: string) => QueryChain;
  order: (column: string, options?: { ascending?: boolean }) => QueryChain;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
} & PromiseLike<QueryResult>;

export type ResolveClient = {
  from: (relation: string) => QueryChain;
};

export const PLAYABLE_GAME_MODES = ["jeopardy", "rapid_fire", "team_battle", "case_study", "adaptive"] as const;

const QUESTION_COLUMNS =
  "id, stem, choices_json, answer_key, explanation, standard_id, concept_id, difficulty, source, approved";

export function asFilterShape(value: FilterShape | GameFilter | null | undefined): FilterShape {
  const raw = (value ?? {}) as Partial<FilterShape>;
  return {
    standards: Array.isArray(raw.standards) ? raw.standards : [],
    concepts: Array.isArray(raw.concepts) ? raw.concepts : [],
    difficulty: Array.isArray(raw.difficulty) ? raw.difficulty : [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    approved_only: raw.approved_only ?? true,
    search: typeof raw.search === "string" ? raw.search : undefined,
  };
}

function emptyDiagnostics(): ResolveDiagnostics {
  return {
    poolItemCount: 0,
    approvedCount: 0,
    filterMatchCount: 0,
    missingPool: false,
    emptyPool: false,
    noMatchingQuestions: false,
  };
}

function mapQuestion(row: Record<string, unknown>): ResolvedGameQuestion {
  return {
    id: String(row.id),
    stem: String(row.stem ?? ""),
    choices_json: row.choices_json ?? [],
    answer_key: (row.answer_key as string | null) ?? null,
    explanation: (row.explanation as string | null) ?? null,
    standard_id: (row.standard_id as string | null) ?? null,
    concept_id: (row.concept_id as string | null) ?? null,
    difficulty: (row.difficulty as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    approved: Boolean(row.approved),
  };
}

function applyFilterColumns(query: QueryChain, filter: FilterShape) {
  let next = query.is("deleted_at", null);
  if (filter.standards.length) next = next.in("standard_id", filter.standards);
  if (filter.concepts.length) next = next.in("concept_id", filter.concepts);
  if (filter.difficulty.length) next = next.in("difficulty", filter.difficulty);
  if (filter.sources.length) next = next.in("source", filter.sources);
  if (filter.search?.trim()) next = next.ilike("stem", `%${filter.search.trim()}%`);
  return next;
}

export function launchBlockMessage(result: ResolveGameResult): string {
  const { diagnostics } = result;
  if (result.source === "pool") {
    if (diagnostics.missingPool) return "This pool no longer exists. Edit the game and pick another source.";
    if (diagnostics.emptyPool) return "This pool has 0 items. Add questions to the pool before launching.";
    if (diagnostics.poolItemCount > 0 && diagnostics.approvedCount === 0) {
      return `Pool has ${diagnostics.poolItemCount} items but 0 are approved. Approve them in the Questions tab to play this game.`;
    }
    return "This game has 0 playable questions.";
  }
  if (diagnostics.noMatchingQuestions) return "Filter matches 0 questions. Edit this game's filter.";
  if (diagnostics.filterMatchCount > 0 && diagnostics.approvedCount === 0) {
    return `${diagnostics.filterMatchCount} match but 0 are approved. Approve them first.`;
  }
  return "This game has 0 playable questions.";
}

export function assertPlayableMode(mode: string | null | undefined) {
  const id = mode || "jeopardy";
  if (!(PLAYABLE_GAME_MODES as readonly string[]).includes(id)) {
    throw new Error("This mode is coming in a later 6D session. Save a playable mode for now.");
  }
}

export class GameLaunchBlockedError extends Error {
  diagnostics: ResolveDiagnostics;
  constructor(message: string, diagnostics: ResolveDiagnostics) {
    super(message);
    this.name = "GameLaunchBlockedError";
    this.diagnostics = diagnostics;
  }
}

export async function resolveGameQuestions(
  template: GameTemplate,
  opts?: { requireApproved?: boolean; supabase?: { from: (relation: string) => unknown } },
): Promise<ResolveGameResult> {
  const requireApproved = opts?.requireApproved ?? true;
  if (!opts?.supabase) {
    throw new Error("resolveGameQuestions requires opts.supabase");
  }
  const supabase = opts.supabase as ResolveClient;
  const diagnostics = emptyDiagnostics();
  const poolId = template.pool_id ?? null;
  const caseIds = (template.case_study_ids ?? []).filter(Boolean);

  if (template.mode === "case_study" || (caseIds.length > 0 && !poolId)) {
    if (caseIds.length === 0) {
      diagnostics.noMatchingQuestions = true;
      return {
        questionIds: [],
        questions: [],
        source: "filter",
        poolId: null,
        filterUsed: null,
        diagnostics,
      };
    }

    const { data: caseRows, error: caseError } = await supabase
      .from("questions")
      .select(`${QUESTION_COLUMNS}, case_study_id, case_study_order, deleted_at`)
      .eq("class_id", template.class_id)
      .in("case_study_id", caseIds)
      .is("deleted_at", null);
    if (caseError) throw new Error(caseError.message);

    const byCase = new Map<string, Array<ResolvedGameQuestion & { order: number }>>();
    for (const raw of (caseRows ?? []) as Record<string, unknown>[]) {
      if (raw?.deleted_at != null) continue;
      const question = mapQuestion(raw);
      const caseId = String(raw.case_study_id ?? "");
      const list = byCase.get(caseId) ?? [];
      list.push({ ...question, order: Number(raw.case_study_order ?? 0) });
      byCase.set(caseId, list);
    }

    const ordered: ResolvedGameQuestion[] = [];
    for (const caseId of caseIds) {
      const list = (byCase.get(caseId) ?? []).sort((a, b) => a.order - b.order);
      ordered.push(...list);
    }

    diagnostics.filterMatchCount = ordered.length;
    diagnostics.approvedCount = ordered.filter((row) => row.approved).length;
    diagnostics.noMatchingQuestions = ordered.length === 0;
    const playable = requireApproved ? ordered.filter((row) => row.approved) : ordered;
    return {
      questionIds: playable.map((row) => row.id),
      questions: playable,
      source: "filter",
      poolId: null,
      filterUsed: null,
      diagnostics,
    };
  }

  if (poolId) {
    const { data: pool } = await supabase
      .from("question_pools")
      .select("id")
      .eq("id", poolId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!pool) {
      diagnostics.missingPool = true;
      return {
        questionIds: [],
        questions: [],
        source: "pool",
        poolId,
        filterUsed: null,
        diagnostics,
      };
    }

    const { data: items, error } = await supabase
      .from("question_pool_items")
      .select(`order, question:questions(${QUESTION_COLUMNS}, deleted_at)`)
      .eq("pool_id", poolId)
      .is("deleted_at", null)
      .order("order", { ascending: true });
    if (error) throw new Error(error.message);

    const live = ((items ?? []) as Array<{ question?: Record<string, unknown> | Record<string, unknown>[] | null }>)
      .map((item) => {
        const raw = item.question;
        return Array.isArray(raw) ? raw[0] : raw;
      })
      .filter((row): row is Record<string, unknown> => Boolean(row) && row?.deleted_at == null)
      .map(mapQuestion);

    diagnostics.poolItemCount = live.length;
    diagnostics.approvedCount = live.filter((row) => row.approved).length;
    diagnostics.emptyPool = live.length === 0;

    const playable = requireApproved ? live.filter((row) => row.approved) : live;
    return {
      questionIds: playable.map((row) => row.id),
      questions: playable,
      source: "pool",
      poolId,
      filterUsed: null,
      diagnostics,
    };
  }

  const filterUsed = asFilterShape(template.filter_json);
  const rawQuery = applyFilterColumns(
    supabase.from("questions").select(QUESTION_COLUMNS).eq("class_id", template.class_id),
    filterUsed,
  );
  const { data: rawRows, error: rawError } = await rawQuery;
  if (rawError) throw new Error(rawError.message);

  const raw = ((rawRows ?? []) as Record<string, unknown>[]).map((row) => mapQuestion(row));
  diagnostics.filterMatchCount = raw.length;
  diagnostics.approvedCount = raw.filter((row) => row.approved).length;
  diagnostics.noMatchingQuestions = raw.length === 0;

  const gateApproved = requireApproved || filterUsed.approved_only;
  const playable = gateApproved ? raw.filter((row) => row.approved) : raw;

  return {
    questionIds: playable.map((row) => row.id),
    questions: playable,
    source: "filter",
    poolId: null,
    filterUsed,
    diagnostics,
  };
}

export async function validateTemplateSource(
  supabase: { from: (relation: string) => unknown },
  template: GameTemplate,
): Promise<ResolveGameResult> {
  assertPlayableMode(template.mode ?? "jeopardy");
  if (template.mode === "case_study" && !(template.case_study_ids ?? []).length) {
    throw new Error("Pick at least one case study.");
  }
  const resolved = await resolveGameQuestions(template, { supabase, requireApproved: true });
  if (resolved.questions.length === 0) {
    throw new Error("This game has 0 playable questions. Go back to Step 2 and fix the source.");
  }
  return resolved;
}
