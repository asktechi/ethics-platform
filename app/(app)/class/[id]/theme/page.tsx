import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ThemeStudio } from "@/components/theme/ThemeStudio";
import { getClass } from "@/lib/data/classes";

export default async function ClassThemePage({
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
          { label: "Theme" },
        ]}
        title="Theme"
        description="Shuffle professional palettes and lock concept image pools before you present."
      />
      <div className="mt-8">
        <ThemeStudio classId={detail.id} />
      </div>
    </div>
  );
}
