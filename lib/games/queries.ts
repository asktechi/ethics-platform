/** Default for every list/count/aggregate of game_instances. */
export const includeRehearsal = false;

type Filterable = {
  eq: (column: string, value: unknown) => unknown;
};

/**
 * Exclude rehearsal rows from instance queries unless the caller is the
 * rehearsal host route itself.
 *
 * TODO(Phase 6E): every analytics aggregation over game_instances or
 * student_performance must go through this helper (or an equivalent
 * `is_rehearsal = false` filter). Never read rehearsal rows into
 * student_performance.
 */
export function filterInstances<Query extends Filterable>(
  query: Query,
  includeRehearsalFlag = includeRehearsal,
): Query {
  if (includeRehearsalFlag) return query;
  return query.eq("is_rehearsal", false) as Query;
}
