import { redirect } from "next/navigation";
import { SessionSummary } from "@/components/quiz/SessionSummary";
import { getSessionReport } from "@/lib/data/quiz";

export default async function QuizSummaryPage({ params }: { params: { sessionId: string } }) {
  let report;
  try {
    report = await getSessionReport(params.sessionId);
  } catch {
    redirect("/login");
  }

  const pool = report.pool;
  return (
    <SessionSummary
      sessionId={report.session.id}
      classId={pool?.class_id}
      poolId={pool?.id}
      poolName={pool?.name ?? "Quiz"}
      questions={report.questions}
      participants={report.participants}
      responses={report.responses}
      teams={report.teams}
      modeId={report.session.mode ?? "jeopardy"}
      teamBonus={Number(((report.session.settings_json as { mode_config?: { team_bonus_per_member?: number } } | null)?.mode_config?.team_bonus_per_member) ?? 20)}
    />
  );
}
