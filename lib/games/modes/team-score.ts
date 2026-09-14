import type { GameTeamRecord } from "@/lib/games/modes/types";

export type TeamPlayer = {
  id: string;
  display_name: string;
  score: number;
  team_id?: string | null;
};

export type TeamResponse = {
  participant_id: string;
  is_correct: boolean | null;
};

export function teamStandings(
  teams: GameTeamRecord[],
  players: TeamPlayer[],
  responses: TeamResponse[],
  teamBonusPerMember: number,
) {
  const correctByPlayer = new Map<string, number>();
  for (const row of responses) {
    if (!row.is_correct) continue;
    correctByPlayer.set(row.participant_id, (correctByPlayer.get(row.participant_id) ?? 0) + 1);
  }
  return teams
    .map((team) => {
      const members = players.filter((player) => player.team_id === team.team_key);
      const contribution = members.reduce(
        (sum, player) => sum + (correctByPlayer.get(player.id) ?? 0) * teamBonusPerMember,
        0,
      );
      return {
        ...team,
        members,
        score: contribution,
        correct: members.reduce((sum, player) => sum + (correctByPlayer.get(player.id) ?? 0), 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function mvpPlayer(players: TeamPlayer[]) {
  return [...players].sort((a, b) => b.score - a.score)[0] ?? null;
}
