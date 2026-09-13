"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { launchQuizAction } from "@/app/(app)/_actions/quiz.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeHostToken } from "@/lib/quiz/host-token";
import type { QuizHostQuestion } from "@/lib/quiz/types";

export function LaunchForm({
  classId,
  poolId,
  poolName,
  questionCount,
  defaultShuffle,
  defaultTime,
  questions,
}: {
  classId: string;
  poolId: string;
  poolName: string;
  questionCount: number;
  defaultShuffle: boolean;
  defaultTime: number | null;
  questions: QuizHostQuestion[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"jeopardy" | "standard">("jeopardy");
  const [timePreset, setTimePreset] = useState(String(defaultTime && [20, 30, 60].includes(defaultTime) ? defaultTime : 30));
  const [customTime, setCustomTime] = useState(defaultTime && ![20, 30, 60].includes(defaultTime) ? String(defaultTime) : "45");
  const [shuffle, setShuffle] = useState(defaultShuffle);
  const [allowLateJoin, setAllowLateJoin] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const timePerQ = timePreset === "custom" ? Number(customTime) : Number(timePreset);

  return (
    <form
      className="space-y-5 border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await launchQuizAction({
            classId,
            poolId,
            mode,
            timePerQ,
            shuffle,
            allowLateJoin,
            showLeaderboard: mode === "jeopardy" ? showLeaderboard : false,
            showCorrectAnswer,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.hostToken) writeHostToken(result.sessionId, result.hostToken);
          router.push(`/quiz/host/${result.sessionId}`);
        });
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Launch</p>
        <h1 className="mt-2 font-display text-2xl text-ivory">{poolName}</h1>
        <p className="mt-1 text-sm text-ivory/55">
          {questionCount} approved question{questionCount === 1 ? "" : "s"} will go live. Status starts as live so
          students can join immediately.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-red-300">Approve questions in this pool before launching.</p>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-ivory/70">Mode</Label>
        <select
          className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
          value={mode}
          onChange={(event) => {
            const next = event.target.value as typeof mode;
            setMode(next);
            if (next === "jeopardy") setShowLeaderboard(true);
          }}
        >
          <option value="jeopardy">Jeopardy — timer + leaderboard during play</option>
          <option value="standard">Standard — scores hidden until the end</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-ivory/70">Time per question</Label>
          <select
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={timePreset}
            onChange={(event) => setTimePreset(event.target.value)}
          >
            <option value="20">20 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {timePreset === "custom" ? (
          <div className="space-y-1.5">
            <Label className="text-ivory/70">Custom seconds</Label>
            <Input type="number" min={5} max={300} value={customTime} onChange={(event) => setCustomTime(event.target.value)} />
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-ivory/80">
        <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
        Shuffle question order
      </label>
      <label className="flex items-center gap-2 text-sm text-ivory/80">
        <input type="checkbox" checked={allowLateJoin} onChange={(event) => setAllowLateJoin(event.target.checked)} />
        Allow late join
      </label>
      <label className="flex items-center gap-2 text-sm text-ivory/80">
        <input
          type="checkbox"
          checked={showLeaderboard}
          disabled={mode !== "jeopardy"}
          onChange={(event) => setShowLeaderboard(event.target.checked)}
        />
        Show leaderboard to players during play
      </label>
      <label className="flex items-center gap-2 text-sm text-ivory/80">
        <input
          type="checkbox"
          checked={showCorrectAnswer}
          onChange={(event) => setShowCorrectAnswer(event.target.checked)}
        />
        Show correct answer after each question
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <Button type="submit" disabled={pending || questions.length === 0} className="bg-gold text-navy hover:bg-gold/90">
        {pending ? "Launching…" : "Launch session"}
      </Button>
    </form>
  );
}
