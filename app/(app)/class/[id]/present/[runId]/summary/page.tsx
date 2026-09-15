import { notFound } from "next/navigation";
import { RunSummary } from "@/components/presentation/RunSummary";
import { getClass } from "@/lib/data/classes";
import { getRunByPublicId } from "@/lib/data/presentation-runs";
import { loadApprovedDeck } from "@/lib/presentation/deck";
import { parseRunSettings } from "@/lib/themes/types";

export const dynamic = "force-dynamic";

export default async function PresentationSummaryPage({
  params,
}: {
  params: { id: string; runId: string };
}) {
  let klass;
  try {
    klass = await getClass(params.id);
  } catch {
    notFound();
  }
  const run = await getRunByPublicId(params.runId);
  if (!run || run.class_id !== params.id) notFound();

  const settings = parseRunSettings(run.settings_json);
  const slides = await loadApprovedDeck(params.id, run.run_id, {
    includeInstructorFields: true,
  });
  const started = run.started_at ? new Date(run.started_at).getTime() : null;
  const ended = run.ended_at ? new Date(run.ended_at).getTime() : Date.now();
  const totalSeconds = started ? Math.max(0, Math.floor((ended - started) / 1000)) : 0;
  const presented = Math.max(
    settings.slides_advanced ?? 0,
    settings.current_slide_index != null ? settings.current_slide_index + 1 : 0,
    slides.filter((_, index) => (settings.slide_seconds?.[index] ?? 0) > 0).length,
  );

  return (
    <RunSummary
      classId={klass.id}
      classTitle={klass.title}
      runLabel={run.status === "ended" ? "Completed run" : "Live run"}
      startedAt={run.started_at}
      totalSeconds={totalSeconds}
      slidesPresented={presented || slides.length}
      peakAudience={settings.peak_audience ?? 0}
      questionsAsked={settings.questions_asked ?? 0}
      slides={slides.map((slide, index) => ({
        slideId: slide.slideId,
        title: slide.title,
        seconds: settings.slide_seconds?.[index] ?? 0,
      }))}
    />
  );
}
