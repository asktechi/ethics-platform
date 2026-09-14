import { notFound } from "next/navigation";
import { ClassWorkspace } from "@/components/ClassWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { classAiSpend } from "@/lib/ai/usage";
import { getClass } from "@/lib/data/classes";
import { listConceptsByClass } from "@/lib/data/concepts";
import { listMaterials } from "@/lib/data/materials";
import { listQuestions } from "@/lib/data/questions";
import { listPools } from "@/lib/data/question-pools";
import { listSections } from "@/lib/data/sections";
import { listStandards } from "@/lib/data/standards";

export default async function ClassPage({ params }: { params: { id: string } }) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  const [sections, concepts, materials, questions, standards, pools, spend] = await Promise.all([
    listSections(detail.id, { includeArchived: true }),
    listConceptsByClass(detail.id, { includeArchived: true }),
    listMaterials(detail.id, { includeArchived: true }),
    listQuestions(detail.id, { includeArchived: true }),
    listStandards(),
    listPools(detail.id),
    classAiSpend(detail.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { label: detail.title },
        ]}
        title={detail.title}
        description={detail.audience || "Class builder"}
      />
      <ClassWorkspace
        detail={detail}
        sections={sections}
        concepts={concepts}
        materials={materials}
        questions={questions}
        standards={standards}
        pools={pools}
        spend={spend}
      />
    </div>
  );
}
