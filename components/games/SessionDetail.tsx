"use client";

import { useState } from "react";
import Link from "next/link";
import { cloneGameAction } from "@/app/(app)/_actions/game.actions";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { ResponseDistribution } from "@/components/quiz/ResponseDistribution";
import { Button } from "@/components/ui/button";
import type { GameInstanceRow } from "@/lib/data/games";
import type { QuizHostQuestion } from "@/lib/quiz/types";
import { useRouter } from "next/navigation";

type ResponseRow = {
  participant_id: string;
  question_id: string;
  choice_key: string | null;
  ms_taken: number | null;
  is_correct: boolean | null;
  points_earned?: number | null;
};

export function SessionDetail({
  instance,
  questions,
  participants,
  responses,
}: {
  instance: GameInstanceRow;
  questions: QuizHostQuestion[];
  participants: LivePlayer[];
  responses: ResponseRow[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [sortKey, setSortKey] = useState<"name" | "choice" | "ms">("ms");
  const snapshot = instance.settings_snapshot;
  const question = questions[index];
  const rows = responses.filter((row) => row.question_id === question?.question_id);
  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    if (row.choice_key) counts[row.choice_key] = (counts[row.choice_key] ?? 0) + 1;
  });
  const ended = instance.status === "ended";
  const ranked = [...participants].sort((a, b) => b.score - a.score);
  const podium = ranked.slice(0, 3);

  function csv(filename: string, text: string) {
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.text(`${instance.template_name ?? "Session"} report`, 14, 18);
    ranked.slice(0, 20).forEach((player, i) => doc.text(`${i + 1}. ${player.display_name} ${player.score}`, 14, 30 + i * 7));
    doc.save(`session-${instance.id}.pdf`);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-gold">
          Template v{instance.template_version} · snapshot time {snapshot.time_per_q}s
        </p>
        <h1 className="mt-2 font-display text-4xl">{instance.template_name}</h1>
        <p className="mt-2 text-sm text-ivory/60">
          {new Date(instance.created_at).toLocaleString()} · {instance.participant_count} players · avg{" "}
          {instance.avg_score ?? "—"} · {instance.duration_seconds ? `${Math.round(instance.duration_seconds / 60)} min` : "—"}
        </p>
      </div>

      {ended ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {podium.map((player, i) => (
            <div key={player.id} className="border border-gold/40 bg-card p-4 text-center">
              <p className="text-xs uppercase text-ivory/45">{i === 0 ? "Gold" : i === 1 ? "Silver" : "Bronze"}</p>
              <p className="mt-2 font-display text-2xl">{player.display_name}</p>
              <p className="text-gold">{player.score}</p>
            </div>
          ))}
        </section>
      ) : null}

      <Leaderboard players={participants} />

      <section>
        <p className="text-[11px] uppercase tracking-[0.14em] text-gold">
          Question {index + 1} of {questions.length}
        </p>
        <h2 className="mt-2 font-display text-2xl">{question?.stem}</h2>
        <div className="mt-4">
          <ResponseDistribution
            choices={question?.choices ?? []}
            counts={counts}
            revealed
            correctKey={question?.answer_key ?? null}
          />
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-ivory/45">
            <tr>
              <th className="cursor-pointer px-2 py-2" onClick={() => setSortKey("name")}>
                Player
              </th>
              <th className="cursor-pointer px-2 py-2" onClick={() => setSortKey("choice")}>
                Choice
              </th>
              <th className="cursor-pointer px-2 py-2" onClick={() => setSortKey("ms")}>
                ms
              </th>
              <th className="px-2 py-2">Correct</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .sort((a, b) => {
                if (sortKey === "choice") return (a.choice_key ?? "").localeCompare(b.choice_key ?? "");
                if (sortKey === "name") {
                  const left = participants.find((item) => item.id === a.participant_id)?.display_name ?? "";
                  const right = participants.find((item) => item.id === b.participant_id)?.display_name ?? "";
                  return left.localeCompare(right);
                }
                return (a.ms_taken ?? 9e9) - (b.ms_taken ?? 9e9);
              })
              .map((row) => (
                <tr key={row.participant_id} className="border-t border-white/5">
                  <td className="px-2 py-2">
                    {participants.find((item) => item.id === row.participant_id)?.display_name ?? row.participant_id}
                  </td>
                  <td className="px-2 py-2">{row.choice_key}</td>
                  <td className="px-2 py-2">{row.ms_taken}</td>
                  <td className="px-2 py-2">{row.is_correct ? "yes" : "no"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
            Previous
          </Button>
          <Button disabled={index >= questions.length - 1} onClick={() => setIndex((value) => value + 1)}>
            Next
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {instance.quiz_session_id ? (
          <Button asChild>
            <Link href={`/quiz/host/${instance.quiz_session_id}/replay`}>Replay as host</Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            void cloneGameAction(instance.template_id).then((result) => {
              if (result.ok) router.push(`/games/${result.id}`);
            });
          }}
        >
          Clone to new game
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            csv(
              `session-${instance.id}-responses.csv`,
              ["player,question,choice,ms,correct", ...responses.map((row) =>
                [
                  participants.find((item) => item.id === row.participant_id)?.display_name,
                  questions.findIndex((item) => item.question_id === row.question_id) + 1,
                  row.choice_key,
                  row.ms_taken,
                  row.is_correct ? 1 : 0,
                ].join(","),
              )].join("\n"),
            )
          }
        >
          CSV responses
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            csv(
              `session-${instance.id}-scores.csv`,
              ["name,score,streak", ...participants.map((row) => [row.display_name, row.score, row.streak].join(","))].join("\n"),
            )
          }
        >
          CSV scores
        </Button>
        <Button variant="outline" onClick={() => void pdf()}>
          PDF report
        </Button>
      </div>
    </div>
  );
}
