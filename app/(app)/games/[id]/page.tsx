import { redirect } from "next/navigation";
import { GameDetail } from "@/components/games/GameDetail";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/data/auth";
import { coverageForQuestions, getGameTemplate, listTemplateInstances } from "@/lib/data/games";
import { resolveGameQuestions } from "@/lib/games/resolve";
import type { QuizHostQuestion } from "@/lib/quiz/types";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; version?: string; rehearsal_done?: string };
}) {
  let template;
  try {
    template = await getGameTemplate(params.id);
  } catch {
    redirect("/games");
  }
  const { supabase } = await requireUser();
  const [resolved, instances] = await Promise.all([
    resolveGameQuestions(template, { supabase, requireApproved: true }),
    listTemplateInstances(template.id),
  ]);
  const questions: QuizHostQuestion[] = resolved.questions.map((row) => ({
    question_id: row.id,
    stem: row.stem,
    choices: (Array.isArray(row.choices_json) ? row.choices_json : []) as QuizHostQuestion["choices"],
    answer_key: row.answer_key ?? "",
    explanation: row.explanation ?? "",
    time_limit_seconds: template.settings_json.time_per_q,
  }));
  const coverage = await coverageForQuestions(questions, template.class_id);
  const toast =
    searchParams.rehearsal_done === "1"
      ? "Rehearsal complete — nothing was saved."
      : searchParams.saved === "1"
        ? `Template updated (v${searchParams.version ?? template.version})`
        : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { label: template.name },
        ]}
        title={template.name}
      />
      <div className="mt-6">
        <GameDetail
          template={template}
          questions={questions}
          resolved={resolved}
          instances={instances}
          coverage={coverage}
          toast={toast}
        />
      </div>
    </div>
  );
}
