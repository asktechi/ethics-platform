import type { QuestionFilters, QuestionRow } from "@/lib/data/questions";

export const PAGE_SIZE = 25;

export type HeaderSelectState = "none" | "some" | "all";

export function railFilters(input: {
  search: string;
  status: QuestionFilters["status"];
  source: QuestionFilters["source"];
  standardFilter: string[];
  conceptFilter: string[];
  difficulty: string[];
  archived: boolean;
}): QuestionFilters {
  return {
    search: input.search.trim() || undefined,
    status: input.status,
    source: input.source,
    standardIds: input.standardFilter,
    conceptIds: input.conceptFilter,
    difficulty: input.difficulty as QuestionFilters["difficulty"],
    includeArchived: input.archived,
  };
}

export function questionMatchesFilters(question: QuestionRow, filters: QuestionFilters) {
  if (!filters.includeArchived && question.deleted_at) return false;
  if (filters.search && !question.stem.toLowerCase().includes(filters.search.toLowerCase())) return false;
  const statuses = filters.statuses?.length
    ? filters.statuses
    : filters.status && filters.status !== "all"
      ? [filters.status]
      : [];
  if (statuses.length) {
    const ok = statuses.some((item) => {
      if (item === "approved") return question.approved;
      if (item === "rejected") return question.rejected;
      return !question.approved && !question.rejected;
    });
    if (!ok) return false;
  }
  if (filters.sources?.length && !filters.sources.includes(question.source)) return false;
  else if (filters.source && filters.source !== "all" && question.source !== filters.source) return false;
  if (filters.standardIds?.length && (!question.standard_id || !filters.standardIds.includes(question.standard_id))) {
    return false;
  }
  if (filters.conceptIds?.length && (!question.concept_id || !filters.conceptIds.includes(question.concept_id))) {
    return false;
  }
  if (filters.difficulty?.length && (!question.difficulty || !filters.difficulty.includes(question.difficulty))) {
    return false;
  }
  if (typeof filters.minConfidence === "number") {
    if (question.ai_tag_confidence == null || question.ai_tag_confidence < filters.minConfidence) return false;
  }
  return true;
}

export function headerSelectState(pageIds: string[], selected: Set<string>): HeaderSelectState {
  if (selected.size === 0) return "none";
  const onPage = pageIds.filter((id) => selected.has(id)).length;
  if (onPage === 0) return "some";
  if (onPage === pageIds.length && pageIds.length > 0) return "all";
  return "some";
}

export function pageSlice<T>(rows: T[], page: number, pageSize = PAGE_SIZE) {
  const start = page * pageSize;
  return rows.slice(start, start + pageSize);
}

export function unionIds(current: Set<string>, ids: string[]) {
  const next = new Set(current);
  ids.forEach((id) => next.add(id));
  return next;
}

export function replaceIds(ids: string[]) {
  return new Set(ids);
}
