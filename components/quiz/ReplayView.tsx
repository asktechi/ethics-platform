"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponseDistribution } from "@/components/quiz/ResponseDistribution";
import { Button } from "@/components/ui/button";
import type { QuizHostQuestion } from "@/lib/quiz/types";

type ResponseRow = {
  question_id: string;
  choice_key: string | null;
  is_correct: boolean | null;
};

export function ReplayView({
  sessionId,
  questions,
  responses,
}: {
  sessionId: string;
  questions: QuizHostQuestion[];
  responses: ResponseRow[];
}) {
  const [index, setIndex] = useState(0);
  const question = questions[index];
  const rows = responses.filter((row) => row.question_id === question?.question_id);
  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    if (row.choice_key) counts[row.choice_key] = (counts[row.choice_key] ?? 0) + 1;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-ivory">
      <p className="text-xs uppercase tracking-[0.18em] text-gold">Replay · read only</p>
      <h1 className="font-display text-3xl">{question?.stem}</h1>
      <p className="text-sm text-ivory/60">
        Question {index + 1} of {questions.length} · correct {question?.answer_key}
      </p>
      <ResponseDistribution
        choices={question?.choices ?? []}
        counts={counts}
        revealed
        correctKey={question?.answer_key ?? null}
      />
      {question?.explanation ? <p className="text-sm text-ivory/70">{question.explanation}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          Previous
        </Button>
        <Button disabled={index >= questions.length - 1} onClick={() => setIndex((value) => value + 1)}>
          Next
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/quiz/host/${sessionId}/summary`}>Back to summary</Link>
        </Button>
      </div>
    </div>
  );
}
