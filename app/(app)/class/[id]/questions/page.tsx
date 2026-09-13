import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { QuestionsBank } from "@/components/questions/QuestionsBank";
import { classAiSpend } from "@/lib/ai/usage";
import { getClass } from "@/lib/data/classes";
import { listConceptsByClass } from "@/lib/data/concepts";
import { listQuestions } from "@/lib/data/questions";
import { listStandards } from "@/lib/data/standards";

export default async function ClassQuestionsPage({
  params,
}: {
  params: { id: string };
}) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  const [questions, standards, concepts, spend] = await Promise.all([
    listQuestions(detail.id, { includeArchived: true }),
    listStandards(),
    listConceptsByClass(detail.id),
    classAiSpend(detail.id),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { label: "Questions" },
        ]}
        title="Question bank"
        description="Import, auto-tag, generate, and approve. AI output stays draft until you confirm."
      />
      <div className="mt-8">
        <QuestionsBank
          classId={detail.id}
          initialQuestions={questions}
          standards={standards}
          concepts={concepts}
          spend={spend}
        />
      </div>
    </div>
  );
}
