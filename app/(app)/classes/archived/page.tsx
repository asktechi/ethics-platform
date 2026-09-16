import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RestoreArchivedClassButton } from "@/components/RestoreArchivedClassButton";
import { listArchivedClasses } from "@/lib/data/classes";

export default async function ArchivedClassesPage() {
  const archived = await listArchivedClasses();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { label: "Archived classes" },
        ]}
        title="Archived classes"
        description="Soft-deleted classes stay here until you restore them. Nothing is hard-deleted."
      />

      {archived.length === 0 ? (
        <EmptyState className="mt-8" title="Nothing archived" />
      ) : (
        <ul className="mt-8 divide-y divide-border border border-border" data-archived-list="true">
          {archived.map((item) => (
            <li
              key={item.id}
              data-archived-class={item.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-display text-xl text-ivory">{item.title}</p>
                <p className="mt-1 text-sm text-ivory/60">
                  {item.levelName}
                  {" · "}
                  {item.materialCount} {item.materialCount === 1 ? "material" : "materials"}
                  {" · "}
                  Archived {item.deleted_at ? format(new Date(item.deleted_at), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <RestoreArchivedClassButton classId={item.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
