import { EmptyState } from "@/components/EmptyState";
import { LevelCard } from "@/components/LevelCard";
import { PageHeader } from "@/components/PageHeader";
import { getInstructorProfile } from "@/lib/data/auth";
import { listRecentClasses } from "@/lib/data/classes";
import { getLevelBySlug, listLevels, levelCopy } from "@/lib/data/levels";

export default async function DashboardPage() {
  const [profile, levels, recent] = await Promise.all([
    getInstructorProfile(),
    listLevels(),
    listRecentClasses(5),
  ]);

  const cards = await Promise.all(
    levels.map(async (level) => {
      const detail = await getLevelBySlug(level.slug);
      return {
        level,
        classCount: detail.classCount,
        description: levelCopy[level.slug] ?? "",
      };
    }),
  );

  const totalClasses = cards.reduce((sum, card) => sum + card.classCount, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ label: "Dashboard" }]}
        title={`Welcome, ${profile.name}`}
        description="Open a CFA level to create and manage classes. One idea per concept. Originals stay immutable."
      />

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <LevelCard
            key={card.level.id}
            level={card.level}
            classCount={card.classCount}
            description={card.description}
          />
        ))}
      </section>

      {totalClasses === 0 ? (
        <EmptyState
          className="mt-10"
          title="Create your first class"
          description="Open Level 1, then add a class. Sections and concepts are built from there."
        />
      ) : recent.length > 0 ? (
        <EmptyState
          className="mt-10"
          title="Recent classes"
          description={recent.map((item) => item.title).join(" · ")}
        />
      ) : null}
    </div>
  );
}
