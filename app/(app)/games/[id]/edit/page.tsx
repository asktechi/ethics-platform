import { redirect } from "next/navigation";
import { EditHydrator } from "@/components/games/EditHydrator";
import { GameWizard } from "@/components/games/GameWizard";
import { PageHeader } from "@/components/PageHeader";
import { getGameTemplate, listGameTags, loadWizardContext } from "@/lib/data/games";

export default async function EditGamePage({ params }: { params: { id: string } }) {
  let template;
  try {
    template = await getGameTemplate(params.id);
  } catch {
    redirect("/games");
  }
  const [context, tags] = await Promise.all([loadWizardContext(), listGameTags()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { href: `/games/${template.id}`, label: template.name },
          { label: "Edit" },
        ]}
        title={`Edit ${template.name}`}
        description="Saving bumps the template version. Live and past sessions keep their snapshot."
      />
      <EditHydrator
        state={{
          classId: template.class_id,
          name: template.name,
          description: template.description ?? "",
          tags: template.tags,
          source: template.pool_id ? "pool" : "filter",
          poolId: template.pool_id ?? "",
          filter: template.filter_json,
          mode: template.mode,
          settings: template.settings_json,
        }}
      />
      <div className="mt-8">
        <GameWizard
          classes={context.classes}
          poolsByClass={context.poolsByClass}
          standards={context.standards}
          conceptsByClass={context.conceptsByClass}
          existingTags={tags}
          editId={template.id}
        />
      </div>
    </div>
  );
}
