import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ClassCard } from "@/components/ClassCard";
import { EmptyState } from "@/components/EmptyState";
import { NewClassButton } from "@/components/NewClassButton";
import { PageHeader } from "@/components/PageHeader";
import { ShowArchivedToggle } from "@/components/ShowArchivedToggle";
import { listClassesByLevel } from "@/lib/data/classes";
import { getLevelBySlug, levelCopy } from "@/lib/data/levels";

export default async function LevelPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { archived?: string };
}) {
  let levelDetail;
  try {
    levelDetail = await getLevelBySlug(params.slug);
  } catch {
    notFound();
  }

  const showArchived = searchParams.archived === "1";
  const classes = await listClassesByLevel(levelDetail.level.id, {
    includeArchived: showArchived,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { label: levelDetail.level.name },
        ]}
        title={levelDetail.level.name}
        description={levelCopy[levelDetail.level.slug]}
        actions={
          <>
            <Suspense>
              <ShowArchivedToggle active={showArchived} />
            </Suspense>
            <NewClassButton
              levelId={levelDetail.level.id}
              levelSlug={levelDetail.level.slug}
            />
          </>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={showArchived ? "No archived classes" : "No classes in this level"}
          description="Create a class to begin sections and concepts."
        />
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {classes.map((item) => (
            <ClassCard
              key={item.id}
              item={item}
              levelId={levelDetail.level.id}
              levelSlug={levelDetail.level.slug}
            />
          ))}
        </section>
      )}
    </div>
  );
}
