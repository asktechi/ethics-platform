"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { Button } from "@/components/ui/button";
import { mvpPlayer, teamStandings } from "@/lib/games/modes/team-score";
import type { GameTeamRecord } from "@/lib/games/modes/types";
import { sortLeaderboard } from "@/lib/quiz/scoring";
import type { QuizHostQuestion } from "@/lib/quiz/types";

type ResponseRow = {
  participant_id: string;
  question_id: string;
  choice_key: string | null;
  ms_taken: number | null;
  is_correct: boolean | null;
};

export function SessionSummary({
  sessionId,
  classId,
  poolId,
  poolName,
  questions,
  participants,
  responses,
  teams = [],
  modeId = "jeopardy",
  teamBonus = 20,
}: {
  sessionId: string;
  classId?: string;
  poolId?: string;
  poolName: string;
  questions: QuizHostQuestion[];
  participants: LivePlayer[];
  responses: ResponseRow[];
  teams?: GameTeamRecord[];
  modeId?: string;
  teamBonus?: number;
}) {
  const [sortKey, setSortKey] = useState<"score" | "name">("score");
  const ranked = useMemo(() => {
    const rows = sortLeaderboard(participants);
    if (sortKey === "name") return [...rows].sort((a, b) => a.display_name.localeCompare(b.display_name));
    return rows;
  }, [participants, sortKey]);
  const podium = ranked.slice(0, 3);

  const perQuestion = questions.map((question, index) => {
    const rows = responses.filter((row) => row.question_id === question.question_id);
    const answered = rows.length;
    const correct = rows.filter((row) => row.is_correct).length;
    const avgMs = answered ? Math.round(rows.reduce((sum, row) => sum + (row.ms_taken ?? 0), 0) / answered) : 0;
    const wrong = rows.filter((row) => !row.is_correct && row.choice_key);
    const tally = new Map<string, number>();
    wrong.forEach((row) => tally.set(row.choice_key ?? "", (tally.get(row.choice_key ?? "") ?? 0) + 1));
    const commonWrong = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      n: index + 1,
      stem: question.stem,
      correctPct: answered ? Math.round((correct / answered) * 100) : 0,
      avgMs,
      commonWrong,
    };
  });

  const avgCorrect = perQuestion.length
    ? Math.round(perQuestion.reduce((sum, row) => sum + row.correctPct, 0) / perQuestion.length)
    : 0;
  const avgMs = responses.length
    ? Math.round(responses.reduce((sum, row) => sum + (row.ms_taken ?? 0), 0) / responses.length)
    : 0;
  const fastest = responses.reduce<(ResponseRow & { name?: string }) | null>((best, row) => {
    if (row.ms_taken == null) return best;
    if (!best || row.ms_taken < (best.ms_taken ?? 9e9)) {
      return { ...row, name: participants.find((player) => player.id === row.participant_id)?.display_name };
    }
    return best;
  }, null);

  function download(filename: string, text: string, type = "text/csv") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvResponses() {
    const header = "participant,question,choice,ms_taken,correct";
    const lines = responses.map((row) => {
      const name = participants.find((player) => player.id === row.participant_id)?.display_name ?? row.participant_id;
      const q = questions.findIndex((item) => item.question_id === row.question_id) + 1;
      return [csv(name), q, row.choice_key ?? "", row.ms_taken ?? "", row.is_correct ? "1" : "0"].join(",");
    });
    download(`quiz-${sessionId}-responses.csv`, [header, ...lines].join("\n"));
  }

  function csvScores() {
    const header = "rank,name,score,streak";
    const lines = ranked.map((player, index) => [index + 1, csv(player.display_name), player.score, player.streak].join(","));
    download(`quiz-${sessionId}-scores.csv`, [header, ...lines].join("\n"));
  }

  async function pdfReport() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${poolName} — session report`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Players: ${participants.length}  Questions: ${questions.length}  Avg correct: ${avgCorrect}%`, 14, 28);
    ranked.slice(0, 15).forEach((player, index) => {
      doc.text(`${index + 1}. ${player.display_name}  ${player.score}`, 14, 40 + index * 7);
    });
    doc.save(`quiz-${sessionId}-report.pdf`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 text-ivory">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">{poolName}</p>
      <h1 className="font-display text-4xl">Session summary</h1>

      {modeId === "team_battle" && teams.length > 0 ? (
        <section className="space-y-3">
          {(() => {
            const standings = teamStandings(teams, participants, responses, teamBonus);
            const winner = standings[0];
            const mvp = mvpPlayer(participants);
            return (
              <>
                <div className="border border-gold/40 bg-gold/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-gold">Winning team</p>
                  <p className="mt-1 font-display text-3xl" style={{ color: winner?.color }}>
                    {winner?.name ?? "—"} · {winner?.score ?? 0}
                  </p>
                  {mvp ? (
                    <p className="mt-2 text-sm text-ivory/70">
                      MVP: {mvp.display_name} · {mvp.score} pts
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {standings.map((team) => (
                    <div key={team.team_key} className="border px-3 py-3" style={{ borderColor: `${team.color}66` }}>
                      <p style={{ color: team.color }}>
                        {team.name} · {team.score}
                      </p>
                      <p className="text-xs text-ivory/50">{team.members.length} players · {team.correct} correct</p>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {podium.map((player, index) => (
          <div key={player.id} className="border border-gold/40 bg-card p-4 text-center">
            <p className="text-xs uppercase text-ivory/45">{index === 0 ? "Gold" : index === 1 ? "Silver" : "Bronze"}</p>
            <span className="mx-auto mt-2 block h-4 w-4 rounded-full" style={{ background: player.avatar_color ?? "#C9A227" }} />
            <p className="mt-2 font-display text-2xl">{player.display_name}</p>
            <p className="text-gold">{player.score}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-2 flex gap-2">
          <Button size="sm" variant={sortKey === "score" ? "default" : "outline"} onClick={() => setSortKey("score")}>
            Sort by score
          </Button>
          <Button size="sm" variant={sortKey === "name" ? "default" : "outline"} onClick={() => setSortKey("name")}>
            Sort by name
          </Button>
        </div>
        <Leaderboard players={ranked} />
      </section>

      <section className="grid gap-3 sm:grid-cols-4 text-sm">
        <Stat label="Questions" value={String(questions.length)} />
        <Stat label="Avg correct" value={`${avgCorrect}%`} />
        <Stat label="Avg response" value={`${(avgMs / 1000).toFixed(1)}s`} />
        <Stat
          label="Fastest"
          value={fastest ? `${fastest.name ?? "Player"} ${(fastest.ms_taken ?? 0) / 1000}s` : "—"}
        />
      </section>

      <section className="overflow-x-auto border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-ivory/45">
            <tr>
              <th className="px-2 py-2">Q#</th>
              <th className="px-2 py-2">Stem</th>
              <th className="px-2 py-2">Correct %</th>
              <th className="px-2 py-2">Avg ms</th>
              <th className="px-2 py-2">Most common wrong</th>
            </tr>
          </thead>
          <tbody>
            {perQuestion.map((row) => (
              <tr key={row.n} className="border-t border-white/5">
                <td className="px-2 py-2">{row.n}</td>
                <td className="max-w-xs truncate px-2 py-2">{row.stem}</td>
                <td className="px-2 py-2">{row.correctPct}%</td>
                <td className="px-2 py-2">{row.avgMs}</td>
                <td className="px-2 py-2">{row.commonWrong}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={csvResponses}>
          Download CSV — all responses
        </Button>
        <Button variant="outline" onClick={csvScores}>
          Download CSV — per-participant scores
        </Button>
        <Button variant="outline" onClick={() => void pdfReport()}>
          Download PDF — session report
        </Button>
        <Button asChild>
          <Link href={`/quiz/host/${sessionId}/replay`}>Replay session</Link>
        </Button>
        {classId && poolId ? (
          <Button asChild variant="outline">
            <Link href={`/class/${classId}/questions/pools/${poolId}/launch`}>New session from this pool</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-card p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ivory/45">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
