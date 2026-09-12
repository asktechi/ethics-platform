export function SessionBStub({
  role,
}: {
  role: "host" | "audience";
}) {
  return (
    <div className="mx-auto max-w-xl border border-dashed border-border bg-card/40 p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
        {role === "host" ? "Presenter" : "Audience"}
      </p>
      <h1 className="mt-2 font-display text-3xl text-ivory">
        Session B — coming next
      </h1>
      <p className="mt-3 text-sm leading-6 text-ivory/65">
        The presentation setup, theme shuffle, and share links are ready. Dual
        presenter and audience views with realtime lockstep ship in Phase 4
        Session B.
      </p>
    </div>
  );
}
