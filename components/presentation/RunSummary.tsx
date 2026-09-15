import Link from "next/link";
import { formatClock } from "@/lib/presentation/format";

export type RunSummarySlide = {
  slideId: string;
  title: string;
  seconds: number;
};

export function RunSummary({
  classId,
  classTitle,
  runLabel,
  startedAt,
  totalSeconds,
  slidesPresented,
  peakAudience,
  questionsAsked,
  slides,
}: {
  classId: string;
  classTitle: string;
  runLabel: string;
  startedAt: string | null;
  totalSeconds: number;
  slidesPresented: number;
  peakAudience: number;
  questionsAsked: number;
  slides: RunSummarySlide[];
}) {
  const avg =
    slidesPresented > 0 ? Math.round(totalSeconds / slidesPresented) : 0;
  const dateLabel = startedAt
    ? new Date(startedAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
  const presentHref = `/class/${classId}/present`;
  const classHref = `/class/${classId}`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-navy text-ivory">
      <header className="relative border-b border-white/10 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
          Session summary
        </p>
        <h1 className="mt-2 font-display text-3xl">{classTitle}</h1>
        <p className="mt-1 text-sm text-ivory/55">
          {runLabel} · {dateLabel} · {formatClock(totalSeconds)}
        </p>
        <Link
          href={classHref}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center border border-white/15 text-lg text-ivory/70 hover:text-ivory"
        >
          ×
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 px-6 py-6 sm:grid-cols-4">
        <Stat label="Slides presented" value={String(slidesPresented)} />
        <Stat label="Avg time / slide" value={formatClock(avg)} />
        <Stat label="Audience peak" value={String(peakAudience)} />
        <Stat label="Questions asked" value={String(questionsAsked)} />
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/40">
          Time on each slide
        </p>
        <ol className="mt-3 divide-y divide-white/10 border border-white/10">
          {slides.map((slide, index) => (
            <li key={slide.slideId} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0 truncate text-sm">
                <span className="mr-2 font-mono text-ivory/35">{index + 1}.</span>
                {slide.title}
              </span>
              <span className="shrink-0 font-mono text-sm text-gold">{formatClock(slide.seconds)}</span>
            </li>
          ))}
        </ol>
      </div>

      <nav className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#071018] px-4 py-3">
        <Link
          href={classHref}
          className="inline-flex h-9 items-center border border-white/15 px-3 text-sm text-ivory hover:bg-white/5"
        >
          ← Back to Class
        </Link>
        <Link
          href={presentHref}
          className="inline-flex h-9 items-center bg-gold px-3 text-sm font-medium text-navy hover:bg-gold/90"
        >
          Present Again
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center px-3 text-sm text-ivory/70 underline-offset-4 hover:underline"
        >
          Dashboard
        </Link>
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-ivory/40">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
