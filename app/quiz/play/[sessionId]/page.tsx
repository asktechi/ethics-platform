import { notFound } from "next/navigation";
import { PlayerShell } from "@/app/quiz/play/[sessionId]/PlayerShell";
import { getPublicPlayContext } from "@/lib/data/quiz";
import type { QuizSettings } from "@/lib/quiz/types";

export default async function QuizPlayPage({ params }: { params: { sessionId: string } }) {
  let context;
  try {
    context = await getPublicPlayContext(params.sessionId);
  } catch {
    notFound();
  }
  const settings = (context.session.settings_json ?? {}) as QuizSettings;

  return (
    <PlayerShell
      sessionId={context.session.id}
      joinCode={context.session.join_code}
      questionCount={context.questionCount}
      hostId={context.hostId}
      initialStatus={context.session.status}
      modeId={context.session.mode ?? "jeopardy"}
      playQuestions={context.playQuestions}
      teams={context.teams}
      modeConfig={(settings.mode_config ?? {}) as Record<string, unknown>}
      gameStartedAt={typeof settings.game_started_at === "string" ? settings.game_started_at : null}
      timePerQ={context.session.time_per_q ?? 30}
      initialCombat={context.bossCombat}
      allowAudienceAdvance={settings.allow_audience_advance === true}
      allowReplay={settings.allow_replay !== false}
    />
  );
}
