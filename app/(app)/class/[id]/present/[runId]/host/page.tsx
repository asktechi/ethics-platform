import { notFound } from "next/navigation";
import { HostView } from "@/components/presentation/HostView";
import { loadHostDeck } from "@/lib/presentation/deck";

export const dynamic = "force-dynamic";

export default async function HostPage({
  params,
}: {
  params: { id: string; runId: string };
}) {
  let deck;
  try {
    deck = await loadHostDeck(params.id, params.runId);
  } catch {
    notFound();
  }

  if (!deck) notFound();

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <HostView
      classId={deck.classId}
      classTitle={deck.classTitle}
      runPk={deck.runPk}
      publicRunId={deck.publicRunId}
      status={deck.status}
      startedAt={deck.startedAt}
      endedAt={deck.endedAt}
      settings={deck.settings}
      slides={deck.slides}
      audienceUrl={`${origin}/present/${deck.publicRunId}/audience`}
    />
  );
}
