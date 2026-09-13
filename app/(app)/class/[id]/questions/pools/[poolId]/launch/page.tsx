import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { LaunchForm } from "@/components/quiz/LaunchForm";
import { getClass } from "@/lib/data/classes";
import { getPoolWithQuestions } from "@/lib/data/question-pools";
import { loadHostQuestions } from "@/lib/data/quiz";

export default async function LaunchQuizPage({
  params,
}: {
  params: { id: string; poolId: string };
}) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  let pool;
  try {
    pool = await getPoolWithQuestions(params.poolId);
  } catch {
    notFound();
  }

  const questions = await loadHostQuestions(params.poolId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { href: `/class/${detail.id}/questions/pools`, label: "Pools" },
          { label: "Launch" },
        ]}
        title="Launch live quiz"
        description="Students join with a 6-character code and a display name. No student login."
      />
      <p className="mt-4 text-sm text-ivory/50">
        <Link href={`/class/${detail.id}/questions/pools`} className="underline">
          Back to pools
        </Link>
      </p>
      <div className="mt-8">
        <LaunchForm
          classId={detail.id}
          poolId={params.poolId}
          poolName={pool.pool.name}
          questionCount={questions.length}
          defaultShuffle={pool.pool.shuffle_on_play}
          defaultTime={pool.pool.time_per_q}
          questions={questions}
        />
      </div>
    </div>
  );
}
