import { redirect } from "next/navigation";
import { SessionDetail } from "@/components/games/SessionDetail";
import { PageHeader } from "@/components/PageHeader";
import { getGameInstance, loadQuestionsByIds } from "@/lib/data/games";
import { listSessionParticipants, listSessionResponses } from "@/lib/data/quiz";

export default async function SessionPage({ params }: { params: { instanceId: string } }) {
  let instance;
  try {
    instance = await getGameInstance(params.instanceId);
  } catch {
    redirect("/games");
  }
  const questionIds = instance.settings_snapshot.question_ids ?? [];
  const questions = await loadQuestionsByIds(questionIds);
  const [participants, responses] = instance.quiz_session_id
    ? await Promise.all([
        listSessionParticipants(instance.quiz_session_id),
        listSessionResponses(instance.quiz_session_id),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { href: `/games/${instance.template_id}`, label: instance.template_name ?? "Game" },
          { label: "Session" },
        ]}
        title="Session replay"
      />
      <div className="mt-8">
        <SessionDetail
          instance={instance}
          questions={questions}
          participants={participants}
          responses={responses}
        />
      </div>
    </div>
  );
}
