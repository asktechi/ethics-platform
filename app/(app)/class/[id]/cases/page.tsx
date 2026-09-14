import { notFound } from "next/navigation";
import { CasesPanel } from "@/components/cases/CasesPanel";
import { PageHeader } from "@/components/PageHeader";
import { listCaseStudies } from "@/lib/data/case-studies";
import { getClass } from "@/lib/data/classes";
import { listQuestions } from "@/lib/data/questions";

export default async function ClassCasesPage({ params }: { params: { id: string } }) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  const [cases, questions] = await Promise.all([
    listCaseStudies(detail.id),
    listQuestions(detail.id, { includeArchived: false }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { label: "Cases" },
        ]}
        title="Case studies"
        description="Build shared vignettes and attach the question bank items that belong to each case."
      />
      <div className="mt-8">
        <CasesPanel classId={detail.id} cases={cases} questions={questions} />
      </div>
    </div>
  );
}
