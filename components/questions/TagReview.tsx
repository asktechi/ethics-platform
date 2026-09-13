"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TagProposal } from "@/lib/ai/tagging";
import type { QuestionRow } from "@/lib/data/questions";
import type { Concept, Standard } from "@/types/db.helpers";

export type ReviewProposal = TagProposal & { questionId: string };

export function TagReview({
  questions,
  proposals,
  standards,
  concepts,
  onApprove,
  onSkip,
}: {
  questions: QuestionRow[];
  proposals: ReviewProposal[];
  standards: Standard[];
  concepts: Concept[];
  onApprove: (items: ReviewProposal[]) => void;
  onSkip: (id: string) => void;
}) {
  const [edits, setEdits] = useState<Record<string, { standardId: string; conceptId: string }>>({});
  const byId = new Map(questions.map((question) => [question.id, question]));

  function resolved(proposal: ReviewProposal): ReviewProposal {
    const edit = edits[proposal.questionId];
    return {
      ...proposal,
      standard_id: edit?.standardId || proposal.standard_id,
      concept_id: edit?.conceptId || proposal.concept_id,
    };
  }

  return (
    <section className="space-y-3 border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ivory">Tag proposals</h2>
          <p className="text-sm text-ivory/55">
            AI mapped {proposals.length} question{proposals.length === 1 ? "" : "s"}. Approve, edit, or skip. Drafts stay
            unapproved until you confirm.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-gold text-navy hover:bg-gold/90"
          onClick={() => onApprove(proposals.filter((item) => item.confidence > 0.8).map(resolved))}
        >
          Approve all with confidence &gt; 0.8
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-ivory/45">
            <tr>
              <th className="px-2 py-2">Question</th>
              <th className="px-2 py-2">Proposed standard</th>
              <th className="px-2 py-2">Proposed concept</th>
              <th className="px-2 py-2">Difficulty</th>
              <th className="px-2 py-2">Confidence</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => {
              const question = byId.get(proposal.questionId);
              const edit = edits[proposal.questionId] ?? {
                standardId: proposal.standard_id ?? "",
                conceptId: proposal.concept_id ?? "",
              };
              return (
                <tr key={proposal.questionId} className="border-b border-white/5">
                  <td className="max-w-xs px-2 py-2 align-top text-ivory/90">
                    <p className="line-clamp-3">{question?.stem ?? proposal.questionId}</p>
                    <p className="mt-1 text-xs text-ivory/45">{proposal.reasoning}</p>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select
                      className="h-9 w-full border border-border bg-navy px-1 text-xs text-ivory"
                      value={edit.standardId}
                      onChange={(event) =>
                        setEdits((prev) => ({
                          ...prev,
                          [proposal.questionId]: { ...edit, standardId: event.target.value, conceptId: "" },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {standards.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select
                      className="h-9 w-full border border-border bg-navy px-1 text-xs text-ivory"
                      value={edit.conceptId}
                      onChange={(event) =>
                        setEdits((prev) => ({
                          ...prev,
                          [proposal.questionId]: { ...edit, conceptId: event.target.value },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {concepts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top capitalize text-ivory/70">{proposal.difficulty}</td>
                  <td className="px-2 py-2 align-top tabular-nums text-ivory/70">{proposal.confidence.toFixed(2)}</td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" onClick={() => onApprove([resolved(proposal)])}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onApprove([resolved(proposal)])}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onSkip(proposal.questionId)}>
                        Skip
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
