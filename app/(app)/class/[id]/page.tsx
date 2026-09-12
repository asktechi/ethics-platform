import { notFound } from "next/navigation";
import { ClassWorkspace } from "@/components/ClassWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { getClass } from "@/lib/data/classes";
import { listConceptsByClass } from "@/lib/data/concepts";
import { listSections } from "@/lib/data/sections";

export default async function ClassPage({ params }: { params: { id: string } }) {
  let detail;
  try {
    detail = await getClass(params.id);
  } catch {
    notFound();
  }

  const [sections, concepts] = await Promise.all([
    listSections(detail.id, { includeArchived: true }),
    listConceptsByClass(detail.id, { includeArchived: true }),
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
      <ClassWorkspace detail={detail} sections={sections} concepts={concepts} />
    </div>
  );
}
