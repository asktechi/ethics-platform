import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PresentSetup } from "@/components/theme/PresentSetup";
import { getClass } from "@/lib/data/classes";

export default async function ClassPresentPage({
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { label: "Present" },
        ]}
        title="Present"
        description="Review drafts, lock run settings, and open the host and audience links."
      />
      <div className="mt-8">
        <PresentSetup classId={detail.id} />
      </div>
    </div>
  );
}
