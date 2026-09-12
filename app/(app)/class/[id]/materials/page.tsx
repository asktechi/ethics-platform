import { notFound } from "next/navigation";
import { MaterialsPanel } from "@/components/materials/MaterialsPanel";
import { PageHeader } from "@/components/PageHeader";
import { getClass } from "@/lib/data/classes";
import { listMaterials } from "@/lib/data/materials";

export default async function ClassMaterialsPage({
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

  const materials = await listMaterials(detail.id, { includeArchived: true });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: `/level/${detail.level.slug}`, label: detail.level.name },
          { href: `/class/${detail.id}`, label: detail.title },
          { label: "Materials" },
        ]}
        title="Materials"
        description="Immutable originals. Derived slides stay editable until you approve them."
      />
      <div className="mt-8">
        <MaterialsPanel classId={detail.id} initialMaterials={materials} />
      </div>
    </div>
  );
}
