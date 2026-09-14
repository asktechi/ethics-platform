"use client";

import { dispatch } from "@/lib/quiz/bus";
import { caseProgressAt, groupQuestionsByCase } from "@/lib/games/case-groups";
import type { HostExtraPanelProps } from "@/lib/games/modes/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CaseStudyHost({ questions, index, responses, players, onSkip }: HostExtraPanelProps) {
  const groups = groupQuestionsByCase(questions);
  const progress = caseProgressAt(groups, index);
  const group = progress.group;

  function showScenarioAgain() {
    if (!group) return;
    dispatch({
      type: "CASE_INTRO",
      case_id: group.caseId,
      title: group.title,
      scenario: group.scenario,
      current_question_index: index,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-gold">
        Case {progress.caseOrdinal} of {progress.caseCount} · Question {progress.questionInCase} of{" "}
        {progress.questionsInCase}
      </p>
      <Button size="sm" variant="outline" onClick={showScenarioAgain}>
        Show scenario again
      </Button>
      <ol className="space-y-2">
        {groups.map((item, groupIndex) => {
          const answered = item.questionIds.filter((id) =>
            responses.some((row) => row.question_id === id && row.choice_key),
          ).length;
          const correct = item.questionIds.filter((id) =>
            responses.some((row) => row.question_id === id && row.is_correct),
          ).length;
          const active = groupIndex === progress.groupIndex;
          return (
            <li
              key={item.caseId}
              className={cn("border px-3 py-2 text-sm", active ? "border-gold bg-gold/10" : "border-white/10")}
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-ivory/50">
                {correct}/{item.questionIds.length} correct · {answered} answered
              </p>
              <ol className="mt-2 space-y-1 text-xs text-ivory/60">
                {item.questionIds.map((id, qIndex) => {
                  const rows = responses.filter((row) => row.question_id === id);
                  const done = rows.length >= Math.max(1, players.length);
                  const ok = rows.some((row) => row.is_correct);
                  return (
                    <li key={id}>
                      Q{qIndex + 1} {done ? (ok ? "· scored" : "· closed") : "· open"}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
      {onSkip ? (
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip question
        </Button>
      ) : null}
    </div>
  );
}
