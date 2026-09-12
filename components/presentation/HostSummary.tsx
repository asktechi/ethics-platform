import Link from "next/link";
import { formatClock } from "@/lib/presentation/format";

export function HostSummary({
  classId,
  totalSeconds,
  slidesAdvanced,
  peakAudience,
  slideCount,
}: {
  classId: string;
  totalSeconds: number;
  slidesAdvanced: number;
  peakAudience: number;
  slideCount: number;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-navy px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Run complete</p>
      <h1 className="mt-4 font-display text-4xl text-ivory">Session ended</h1>
      <dl className="mt-10 grid w-full max-w-xl grid-cols-2 gap-4 text-left">
        <Stat label="Total time" value={formatClock(totalSeconds)} />
        <Stat label="Slides advanced" value={`${slidesAdvanced}`} />
        <Stat label="Peak audience" value={`${peakAudience}`} />
        <Stat label="Deck size" value={`${slideCount}`} />
      </dl>
      <Link
        href={`/class/${classId}/present`}
        className="mt-10 text-sm text-gold underline-offset-4 hover:underline"
      >
        Back to presentation setup
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/5 px-4 py-3">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ivory/40">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-ivory">{value}</dd>
    </div>
  );
}
