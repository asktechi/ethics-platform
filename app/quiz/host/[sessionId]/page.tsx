import { notFound, redirect } from "next/navigation";
import { HostDashboard } from "@/components/quiz/HostDashboard";
import { loadQuestionsByIds } from "@/lib/data/games";
import {
  getHostSession,
  listSessionParticipants,
  listSessionResponses,
  loadHostQuestions,
} from "@/lib/data/quiz";
import type { QuizSettings } from "@/lib/quiz/types";
import { headers } from "next/headers";

export default async function QuizHostPage({ params }: { params: { sessionId: string } }) {
  let session;
  try {
    session = await getHostSession(params.sessionId);
  } catch {
    redirect("/login");
  }

  if (session.status === "ended") {
    redirect(`/quiz/host/${params.sessionId}/summary`);
  }

  const pool = session.pool as { id?: string; name?: string } | null;
  const settings = (session.settings_json ?? {}) as QuizSettings;
  const loaded = pool?.id
    ? await loadHostQuestions(pool.id)
    : await loadQuestionsByIds(settings.question_ids ?? []);
  if (loaded.length === 0) notFound();
  const [participants, responses] = await Promise.all([
    listSessionParticipants(session.id),
    listSessionResponses(session.id),
  ]);
  const ordered = (settings.question_ids ?? loaded.map((item) => item.question_id))
    .map((id) => loaded.find((item) => item.question_id === id))
    .filter(Boolean);
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:43127";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const joinUrl = `${proto}://${host}/quiz/join/${session.join_code}`;

  return (
    <HostDashboard
      sessionId={session.id}
      hostId={session.host_id}
      hostToken={settings.host_token ?? ""}
      joinCode={session.join_code}
      joinUrl={joinUrl}
      questions={ordered as typeof loaded}
      timePerQ={session.time_per_q ?? 30}
      initialIndex={session.current_question_index ?? 0}
      initialReveal={Boolean(session.reveal_answer)}
      initialEnded={session.status === "ended"}
      initialPaused={Boolean(settings.paused_at)}
      initialRemainingMs={settings.remaining_ms ?? null}
      initialQuestionStartedAt={settings.question_started_at ?? null}
      initialParticipants={participants}
      initialResponses={responses}
      poolName={pool?.name ?? "Game"}
    />
  );
}
