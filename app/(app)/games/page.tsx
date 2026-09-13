import Link from "next/link";
import { GamesHub } from "@/components/games/GamesHub";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { listGameTemplates } from "@/lib/data/games";
import { listStandards } from "@/lib/data/standards";

export default async function GamesPage() {
  const [templates, standards] = await Promise.all([
    listGameTemplates({ includeArchived: true }),
    listStandards(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ href: "/dashboard", label: "Dashboard" }, { label: "Games" }]}
        title="Games"
        description="Templates you can launch, schedule, and replay without rebuilding the rules."
        actions={
          <Button asChild className="bg-gold text-navy hover:bg-gold/90">
            <Link href="/games/new">New Game</Link>
          </Button>
        }
      />
      <div className="mt-8">
        <GamesHub templates={templates} standards={standards} />
      </div>
    </div>
  );
}
