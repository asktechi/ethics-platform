import { redirect } from "next/navigation";
import { ReplayView } from "@/components/quiz/ReplayView";
import { getSessionReport } from "@/lib/data/quiz";

export default async function QuizReplayPage({ params }: { params: { sessionId: string } }) {
  let report;
  try {
    report = await getSessionReport(params.sessionId);
  } catch {
    redirect("/login");
  }

  return (
    <ReplayView
      sessionId={report.session.id}
      questions={report.questions}
      responses={report.responses}
    />
  );
}
