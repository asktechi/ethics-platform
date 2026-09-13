import { notFound, redirect } from "next/navigation";
import { HostStub } from "@/components/quiz/HostStub";
import { getHostSession, loadHostQuestions } from "@/lib/data/quiz";
import { headers } from "next/headers";

export default async function QuizHostPage({ params }: { params: { sessionId: string } }) {
  let session;
  try {
    session = await getHostSession(params.sessionId);
  } catch {
    redirect("/login");
  }

  const pool = session.pool as { id?: string; name?: string } | null;
  if (!pool?.id) notFound();
  const questions = await loadHostQuestions(pool.id);
  const settings = (session.settings_json ?? {}) as { question_ids?: string[] };
  const ordered = (settings.question_ids ?? questions.map((item) => item.question_id))
    .map((id) => questions.find((item) => item.question_id === id))
    .filter(Boolean);
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:43127";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const joinUrl = `${proto}://${host}/quiz/join/${session.join_code}`;

  return (
    <HostStub
      sessionId={session.id}
      joinCode={session.join_code}
      joinUrl={joinUrl}
      questions={ordered as typeof questions}
      timePerQ={session.time_per_q ?? 30}
    />
  );
}
