export default function HostRunNotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Not found</p>
      <h1 className="mt-3 font-display text-3xl text-ivory">Check the link with your instructor</h1>
      <p className="mt-3 text-sm text-ivory/60">
        That presentation run does not exist, or it belongs to a different class.
      </p>
    </div>
  );
}
