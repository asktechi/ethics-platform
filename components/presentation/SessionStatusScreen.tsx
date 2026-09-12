export function SessionStatusScreen({
  title,
  body,
  tone = "waiting",
}: {
  title: string;
  body: string;
  tone?: "waiting" | "ended" | "error";
}) {
  const accent = tone === "ended" ? "text-gold" : tone === "error" ? "text-red-300" : "text-ivory/50";
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-6">
      <div className="max-w-lg text-center">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${accent}`}>
          {tone === "ended" ? "Session" : tone === "error" ? "Unavailable" : "Stand by"}
        </p>
        <h1 className="mt-4 font-display text-4xl text-ivory">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-ivory/65">{body}</p>
      </div>
    </main>
  );
}

export function PresentationSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy p-6">
      <div className="mb-4 h-3 w-40 animate-pulse bg-white/10" />
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[35%_45%_20%]">
        <div className="animate-pulse bg-white/5" />
        <div className="animate-pulse bg-white/10" />
        <div className="animate-pulse bg-white/5" />
      </div>
      <p className="mt-4 text-xs text-ivory/40">{label}</p>
    </div>
  );
}
