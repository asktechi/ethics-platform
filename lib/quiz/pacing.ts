export const AUTO_REVEAL_DELAY_MS = 500;
export const DISCONNECT_GRACE_MS = 3000;
export const MAJORITY_ADVANCE_RATIO = 0.51;

export type PacingPlayer = {
  id: string;
  connected?: boolean;
  disconnectedSince?: number | null;
};

export type PacingResponse = {
  participant_id: string;
  question_id: string | null;
};

export function uniqueAnsweredIds(
  responses: PacingResponse[],
  questionId: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!questionId) return ids;
  for (const row of responses) {
    if (row.question_id === questionId) ids.add(row.participant_id);
  }
  return ids;
}

export function isDisconnectedForPacing(
  player: PacingPlayer,
  now: number,
  graceMs = DISCONNECT_GRACE_MS,
): boolean {
  if (player.disconnectedSince == null) return false;
  return now - player.disconnectedSince >= graceMs;
}

export function countPacingProgress({
  players,
  responses,
  questionId,
  now,
  disconnectGraceMs = DISCONNECT_GRACE_MS,
}: {
  players: PacingPlayer[];
  responses: PacingResponse[];
  questionId: string | null | undefined;
  now: number;
  disconnectGraceMs?: number;
}) {
  const answered = uniqueAnsweredIds(responses, questionId);
  let credited = 0;
  for (const player of players) {
    if (answered.has(player.id) || isDisconnectedForPacing(player, now, disconnectGraceMs)) {
      credited += 1;
    }
  }
  const expected = players.length;
  const allAnswered = expected > 0 && credited >= expected;
  return {
    answeredCount: answered.size,
    creditedCount: credited,
    expectedCount: expected,
    allAnswered,
    label:
      expected === 0 ? "0 of 0 answered" : `${Math.min(answered.size, expected)} of ${expected} answered`,
  };
}

export function shouldAutoReveal(opts: {
  modeId: string;
  rehearsal: boolean;
  phase: string;
  paused: boolean;
  timeUp: boolean;
  allAnswered: boolean;
}): boolean {
  if (opts.modeId === "rapid_fire" || opts.modeId === "adaptive") return false;
  if (opts.rehearsal) return false;
  if (opts.phase !== "question" || opts.paused) return false;
  return opts.timeUp || opts.allAnswered;
}

export function revealDelayMs(allAnswered: boolean, timeUp: boolean): number {
  if (allAnswered && !timeUp) return AUTO_REVEAL_DELAY_MS;
  return 0;
}

export function majorityHasAdvanced(advancedCount: number, participantCount: number): boolean {
  if (participantCount <= 0 || advancedCount <= 0) return false;
  return advancedCount / participantCount >= MAJORITY_ADVANCE_RATIO;
}
