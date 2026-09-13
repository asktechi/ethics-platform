import { notFound } from "next/navigation";
import { PlayerView } from "@/components/quiz/PlayerView";
import { getPublicPlayContext } from "@/lib/data/quiz";

export default async function QuizPlayPage({ params }: { params: { sessionId: string } }) {
  let context;
  try {
    context = await getPublicPlayContext(params.sessionId);
  } catch {
    notFound();
  }

  return (
    <PlayerView
      sessionId={context.session.id}
      joinCode={context.session.join_code}
      questionCount={context.questionCount}
      hostId={context.hostId}
      initialStatus={context.session.status}
    />
  );
}
