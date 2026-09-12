export function MissingApiKeyNotice() {
  return (
    <div
      role="status"
      className="border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ivory"
    >
      Set <code className="font-mono text-gold">UNSPLASH_ACCESS_KEY</code> to
      enable image pools. Theme shuffle still works without it.
    </div>
  );
}
