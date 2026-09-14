import { GameWizard } from "@/components/games/GameWizard";
import { PageHeader } from "@/components/PageHeader";
import { listGameTags, loadWizardContext } from "@/lib/data/games";

export default async function NewGamePage() {
  const [context, tags] = await Promise.all([loadWizardContext(), listGameTags()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { label: "New" },
        ]}
        title="New game"
        description="Five steps. Save a template, then launch it whenever the room is ready."
      />
      <div className="mt-8">
        <GameWizard
          classes={context.classes}
          poolsByClass={context.poolsByClass}
          standards={context.standards}
          conceptsByClass={context.conceptsByClass}
          casesByClass={context.casesByClass}
          bosses={context.bosses}
          existingTags={tags}
        />
      </div>
    </div>
  );
}
