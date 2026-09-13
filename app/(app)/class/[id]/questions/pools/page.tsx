import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PoolsBoard } from "@/components/questions/PoolsBoard";
import { getClass } from "@/lib/data/classes";
import { listPools } from "@/lib/data/question-pools";
import { listQuestions } from "@/lib/data/questions";

export default async function QuestionPoolsPage({
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

  const [pools, questions] = await Promise.all([
    listPools(detail.id, true),
    listQuestions(detail.id, { includeArchived: false }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { href: `/class/${detail.id}/questions`, label: "Questions" },
          { label: "Pools" },
        ]}
        title="Question pools"
        description="Group approved items for a later live quiz. Shuffle and time settings live on the pool."
      />
      <div className="mt-8">
        <PoolsBoard classId={detail.id} pools={pools} questions={questions} />
      </div>
    </div>
  );
}
