"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionRow } from "@/lib/data/questions";
import type { Concept, Standard } from "@/types/db.helpers";

function asChoices(value: QuestionRow["choices_json"]) {
  return Array.isArray(value) ? value : [];
}

function choiceText(choices: QuestionRow["choices_json"], key: string) {
  return asChoices(choices).find((item) => item.key.toUpperCase() === key)?.text ?? "";
}

export function QuestionDrawer({
  question,
  standards,
  concepts,
  onSave,
}: {
  question: QuestionRow | null;
  standards: Standard[];
  concepts: Concept[];
  onSave: (patch: {
    stem?: string;
    choices_json?: Array<{ key: string; text: string }>;
    answer_key?: string | null;
    explanation?: string | null;
    standard_id?: string | null;
    concept_id?: string | null;
    difficulty?: "easy" | "medium" | "hard" | null;
    approved?: boolean;
    rejected?: boolean;
  }) => void;
}) {
  const [stem, setStem] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [d, setD] = useState("");
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [standardId, setStandardId] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  useEffect(() => {
    if (!question) return;
    setStem(question.stem);
    setA(choiceText(question.choices_json, "A"));
    setB(choiceText(question.choices_json, "B"));
    setC(choiceText(question.choices_json, "C"));
    setD(choiceText(question.choices_json, "D"));
    setAnswer(question.answer_key ?? "");
    setExplanation(question.explanation ?? "");
    setStandardId(question.standard_id ?? "");
    setConceptId(question.concept_id ?? "");
    setDifficulty(question.difficulty ?? "medium");
  }, [question]);

  if (!question) {
    return (
      <aside className="hidden h-full items-center justify-center border border-border bg-card p-6 text-sm text-ivory/45 lg:flex">
        Select a question to edit the stem, choices, tags, and approval.
      </aside>
    );
  }

  const filteredConcepts = concepts;

  function patch() {
    return {
      stem,
      choices_json: [
        { key: "A", text: a },
        { key: "B", text: b },
        { key: "C", text: c },
        { key: "D", text: d },
      ].filter((item) => item.text.trim()),
      answer_key: answer,
      explanation,
      standard_id: standardId || null,
      concept_id: conceptId || null,
      difficulty: difficulty as "easy" | "medium" | "hard",
    };
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-ivory">Question</p>
        <Badge variant="outline" className="border-ivory/20 text-ivory/70">
          {question.deleted_at ? "archived" : question.approved ? "approved" : question.rejected ? "rejected" : "pending"}
        </Badge>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="q-stem" className="text-ivory/70">
            Stem
          </Label>
          <Textarea id="q-stem" value={stem} onChange={(event) => setStem(event.target.value)} rows={5} />
        </div>
        {(["A", "B", "C", "D"] as const).map((key) => {
          const value = key === "A" ? a : key === "B" ? b : key === "C" ? c : d;
          const set = key === "A" ? setA : key === "B" ? setB : key === "C" ? setC : setD;
          const isAnswer = answer.trim().toUpperCase() === key;
          return (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`q-${key}`} className={isAnswer ? "text-emerald-300" : "text-ivory/70"}>
                Choice {key}
                {isAnswer ? " — answer" : ""}
              </Label>
              <Input
                id={`q-${key}`}
                value={value}
                onChange={(event) => set(event.target.value)}
                className={isAnswer ? "border-emerald-500/60 bg-emerald-950/30" : ""}
              />
            </div>
          );
        })}
        <div className="space-y-1.5">
          <Label htmlFor="q-ans" className="text-ivory/70">
            Answer key
          </Label>
          <Input id="q-ans" value={answer} onChange={(event) => setAnswer(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-ex" className="text-ivory/70">
            Explanation
          </Label>
          <Textarea id="q-ex" value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={4} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="q-std" className="text-ivory/70">
              Standard
            </Label>
            <select
              id="q-std"
              className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
              value={standardId}
              onChange={(event) => {
                setStandardId(event.target.value);
                setConceptId("");
              }}
            >
              <option value="">—</option>
              {standards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} {item.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-con" className="text-ivory/70">
              Concept
            </Label>
            <select
              id="q-con"
              className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
              value={conceptId}
              onChange={(event) => setConceptId(event.target.value)}
            >
              <option value="">—</option>
              {filteredConcepts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q-diff" className="text-ivory/70">
            Difficulty
          </Label>
          <select
            id="q-diff"
            className="h-10 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        {question.ai_tag_reasoning ? (
          <div className="border border-white/10 bg-navy/50 p-3 text-sm text-ivory/80">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline" className="border-gold/40 text-gold">
                AI tag
              </Badge>
              <span className="tabular-nums text-xs text-ivory/50">
                Confidence {question.ai_tag_confidence ?? "—"}
              </span>
            </div>
            <p>{question.ai_tag_reasoning}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
        <Button size="sm" className="bg-gold text-navy hover:bg-gold/90" onClick={() => onSave(patch())}>
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onSave({ ...patch(), approved: true, rejected: false })}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSave({ approved: false, rejected: true })}>
          Reject
        </Button>
      </div>
    </aside>
  );
}
