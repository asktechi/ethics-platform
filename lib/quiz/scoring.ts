export function scoreQuestion(
  msTaken: number,
  timePerQSeconds: number,
  priorStreak: number,
  correct: boolean,
) {
  if (!correct) {
    return { points: 0, timeBonus: 0, streakBonus: 0, nextStreak: 0 };
  }
  const limit = Math.max(1, timePerQSeconds * 1000);
  const elapsed = Math.min(Math.max(0, msTaken), limit);
  const timeBonus = Math.min(100, Math.max(0, Math.round(100 * (1 - elapsed / limit))));
  const streakBonus = 20 * Math.max(0, priorStreak);
  return {
    points: 100 + timeBonus + streakBonus,
    timeBonus,
    streakBonus,
    nextStreak: priorStreak + 1,
  };
}

export function sortLeaderboard<T extends { score: number; last_correct_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.last_correct_at ? new Date(a.last_correct_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.last_correct_at ? new Date(b.last_correct_at).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}
