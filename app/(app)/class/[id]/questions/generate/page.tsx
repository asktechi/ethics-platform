import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { GeneratePanel } from "@/components/questions/GeneratePanel";
import { getClass } from "@/lib/data/classes";
import { listConceptsByClass } from "@/lib/data/concepts";
import { listApprovedClassSlides } from "@/lib/data/materials";
import { listStandards } from "@/lib/data/standards";

export default async function GenerateQuestionsPage({
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

  const [standards, concepts, slides] = await Promise.all([
    listStandards(),
    listConceptsByClass(detail.id),
    listApprovedClassSlides(detail.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { href: `/class/${detail.id}/questions`, label: "Questions" },
          { label: "Generate" },
        ]}
        title="Generate questions"
        description="gpt-4o drafts stay pending until you approve them."
      />
      <div className="mt-8">
        <GeneratePanel
          classId={detail.id}
          standards={standards}
          concepts={concepts}
          slides={slides}
        />
      </div>
    </div>
  );
}
