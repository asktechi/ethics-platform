"use client";

import { useState } from "react";
import { quizReassignTeamAction } from "@/app/(app)/_actions/quiz.actions";
import { teamStandings } from "@/lib/games/modes/team-score";
import type { HostExtraPanelProps } from "@/lib/games/modes/types";
import { cn } from "@/lib/utils";

export function TeamBattleHost({
  sessionId,
  players,
  responses,
  teams,
  modeConfig,
  phase,
}: HostExtraPanelProps) {
  const bonus = Number(modeConfig.team_bonus_per_member ?? 20);
  const standings = teamStandings(teams, players, responses, bonus);
  const [tab, setTab] = useState<"individual" | "teams">("teams");
  const chips = (
    <div className="flex flex-wrap gap-2">
      {standings.map((team) => (
        <span
          key={team.team_key}
          className="border px-2 py-1 text-sm"
          style={{ borderColor: team.color, color: team.color }}
        >
          {team.name} {team.score}
        </span>
      ))}
    </div>
  );
  if (phase === "header") return chips;
  const lobby = phase === "ready" || phase === "countdown";

  async function move(participantId: string, teamKey: string) {
    await quizReassignTeamAction(sessionId, participantId, teamKey);
  }

  return (
    <div className="space-y-3">
      {chips}

      {lobby ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => {
            const members = players.filter((player) => player.team_id === team.team_key);
            const unassigned = players.filter((player) => !player.team_id);
            return (
              <div
                key={team.team_key}
                className="border p-3"
                style={{ borderColor: `${team.color}66` }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain");
                  if (id) void move(id, team.team_key);
                }}
              >
                <p className="text-sm font-medium" style={{ color: team.color }}>
                  {team.name}
                </p>
                <ul className="mt-2 min-h-16 space-y-1">
                  {members.map((player) => (
                    <li
                      key={player.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", player.id)}
                      className="flex cursor-grab items-center justify-between text-sm"
                    >
                      <span>{player.display_name}</span>
                      <select
                        className="bg-navy text-xs"
                        value={player.team_id ?? ""}
                        onChange={(event) => void move(player.id, event.target.value)}
                      >
                        {teams.map((option) => (
                          <option key={option.team_key} value={option.team_key}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                  {team.team_key === teams[0]?.team_key
                    ? unassigned.map((player) => (
                        <li key={player.id} className="flex items-center justify-between text-sm text-ivory/50">
                          <span>{player.display_name} (unassigned)</span>
                          <select
                            className="bg-navy text-xs"
                            value=""
                            onChange={(event) => void move(player.id, event.target.value)}
                          >
                            <option value="">Assign</option>
                            {teams.map((option) => (
                              <option key={option.team_key} value={option.team_key}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))
                    : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className={cn("border px-2 py-1", tab === "teams" ? "border-gold text-gold" : "border-white/20")}
              onClick={() => setTab("teams")}
            >
              Teams
            </button>
            <button
              type="button"
              className={cn("border px-2 py-1", tab === "individual" ? "border-gold text-gold" : "border-white/20")}
              onClick={() => setTab("individual")}
            >
              Individual
            </button>
          </div>
          {tab === "teams" ? (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Team breakdown</p>
              {standings.map((team) => (
                <div key={team.team_key} className="border border-white/10 px-2 py-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: team.color }}>{team.name}</span>
                    <span className="text-gold">{team.score}</span>
                  </div>
                  <p className="text-xs text-ivory/45">
                    {team.members.length} players · {team.correct} correct · +{bonus} each
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((player, index) => (
                  <li key={player.id} className="flex justify-between">
                    <span>
                      {index + 1}. {player.display_name}
                    </span>
                    <span className="text-gold">{player.score}</span>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
