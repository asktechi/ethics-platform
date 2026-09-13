import { redirect } from "next/navigation";
import { GameDetail } from "@/components/games/GameDetail";
import { PageHeader } from "@/components/PageHeader";
import { coverageForQuestions, getGameTemplate, listTemplateInstances, resolveTemplateQuestions } from "@/lib/data/games";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; version?: string };
}) {
  let template;
  try {
    template = await getGameTemplate(params.id);
  } catch {
    redirect("/games");
  }
  const [questions, instances] = await Promise.all([
    resolveTemplateQuestions(template),
    listTemplateInstances(template.id),
  ]);
  const coverage = await coverageForQuestions(questions, template.class_id);
  const toast =
    searchParams.saved === "1"
      ? `Template updated (v${searchParams.version ?? template.version})`
      : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { label: template.name },
        ]}
        title={template.name}
      />
      <div className="mt-6">
        <GameDetail
          template={template}
          questions={questions}
          instances={instances}
          coverage={coverage}
          toast={toast}
        />
      </div>
    </div>
  );
}
