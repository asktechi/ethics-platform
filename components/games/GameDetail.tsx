"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { archiveGameAction, scheduleGameAction, startGameAction } from "@/app/(app)/_actions/game.actions";
import { ModeBadge } from "@/components/games/ModeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GameInstanceRow, GameTemplateRow } from "@/lib/data/games";
import { MODE_META } from "@/lib/games/types";
import type { QuizHostQuestion } from "@/lib/quiz/types";

export function GameDetail({
  template,
  questions,
  instances,
  coverage,
  toast,
}: {
  template: GameTemplateRow;
  questions: QuizHostQuestion[];
  instances: GameInstanceRow[];
  coverage: Array<{ code: string; title: string; count: number }>;
  toast?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const playable = MODE_META[template.mode].playable;
  const recent = instances.slice(0, 3);
  const scored = instances.filter((row) => row.avg_score != null);
  const avgScore = scored.length
    ? scored.reduce((sum, row) => sum + Number(row.avg_score), 0) / scored.length
    : Number.NaN;
  const avgDuration =
    instances.filter((row) => row.duration_seconds != null).reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0) /
    Math.max(1, instances.filter((row) => row.duration_seconds != null).length);

  return (
    <div>
      {toast ? <p className="mb-4 border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">{toast}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ModeBadge mode={template.mode} />
          <h1 className="mt-2 font-display text-4xl">{template.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ivory/60">{template.description}</p>
          <p className="mt-2 text-xs text-ivory/40">v{template.version}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-gold text-navy hover:bg-gold/90"
            disabled={!playable || pending}
            onClick={() => {
              setError(null);
              start(async () => {
                const result = await startGameAction(template.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.push(`/quiz/host/${result.sessionId}`);
              });
            }}
          >
            Start Game
          </Button>
          <Button variant="outline" onClick={() => setScheduleOpen(true)}>
            Schedule
          </Button>
          <Button asChild variant="outline">
            <Link href={`/games/${template.id}/edit`}>Edit</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              start(async () => {
                await archiveGameAction(template.id, Boolean(template.deleted_at));
                router.push("/games");
              });
            }}
          >
            {template.deleted_at ? "Restore" : "Delete"}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {!playable ? <p className="mt-3 text-sm text-ivory/50">This mode is coming in Phase 6D. The template is saved.</p> : null}

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-4 text-sm">
            <Stat label="Plays" value={String(template.play_count)} />
            <Stat
              label="Last played"
              value={template.last_played_at ? formatDistanceToNow(new Date(template.last_played_at), { addSuffix: true }) : "—"}
            />
            <Stat label="Avg score" value={Number.isFinite(avgScore) ? avgScore.toFixed(0) : "—"} />
            <Stat label="Avg duration" value={avgDuration ? `${Math.round(avgDuration / 60)} min` : "—"} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Coverage</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {coverage.map((item) => (
                <span key={item.code} className="border border-white/10 px-2 py-1 text-xs">
                  {item.code}: {item.count} questions
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Recent sessions</p>
            <ul className="mt-2 space-y-2">
              {recent.map((row) => (
                <li key={row.id}>
                  <Link href={`/sessions/${row.id}`} className="text-sm text-ivory/80 hover:text-gold">
                    {new Date(row.created_at).toLocaleString()} · {row.participant_count} players · {row.status}
                  </Link>
                </li>
              ))}
              {recent.length === 0 ? <li className="text-sm text-ivory/45">No sessions yet.</li> : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="mt-6">
          <p className="mb-3 text-sm text-ivory/55">
            {template.pool_id ? "Resolved from the pool." : "Filter re-evaluates on launch."}
          </p>
          <ol className="space-y-2">
            {questions.map((question, index) => (
              <li key={question.question_id} className="border border-white/10 px-3 py-2 text-sm">
                {index + 1}. {question.stem}
              </li>
            ))}
          </ol>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-ivory/45">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Players</th>
                <th className="px-2 py-2">Avg score</th>
                <th className="px-2 py-2">Top scorer</th>
                <th className="px-2 py-2">Duration</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                  onClick={() => router.push(`/sessions/${row.id}`)}
                >
                  <td className="px-2 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2">{row.participant_count}</td>
                  <td className="px-2 py-2">{row.avg_score ?? "—"}</td>
                  <td className="px-2 py-2">{row.top_scorer ?? "—"}</td>
                  <td className="px-2 py-2">{row.duration_seconds ? `${Math.round(row.duration_seconds / 60)}m` : "—"}</td>
                  <td className="px-2 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="border border-dashed border-white/15 bg-card/40 p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-gold">Coming in Phase 6E</p>
            <h2 className="mt-2 font-display text-2xl">Student analytics</h2>
            <p className="mt-2 max-w-xl text-sm text-ivory/60">
              Weak-standard heatmaps, CFA band overlays, and cohort comparison will land here. Performance rows are already
              written on session end.
            </p>
            <div className="mt-6 grid h-40 grid-cols-4 gap-2">
              {["I(A)", "I(B)", "I(C)", "II"].map((label, index) => (
                <div key={label} className="flex flex-col justify-end bg-white/5 p-2">
                  <div className="bg-gold/60" style={{ height: `${30 + index * 18}%` }} />
                  <p className="mt-1 text-[11px] text-ivory/45">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <p className="text-sm text-ivory/60">Edit name, source, and rules. Saving bumps the template version.</p>
          <Button asChild className="mt-4 bg-gold text-navy hover:bg-gold/90">
            <Link href={`/games/${template.id}/edit`}>Open editor</Link>
          </Button>
        </TabsContent>
      </Tabs>

      {scheduleOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/80 p-4">
          <div className="w-full max-w-sm space-y-3 border border-border bg-card p-4">
            <p className="font-display text-xl">Schedule</p>
            <Input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  start(async () => {
                    const result = await scheduleGameAction(template.id, when);
                    if (!result.ok) setError(result.error);
                    else setScheduleOpen(false);
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
