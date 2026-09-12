export function PptxFallbackBanner() {
  return (
    <div
      role="status"
      className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ivory"
    >
      PPTX text extracted with the fallback parser. Full-fidelity conversion
      (Fly.io LibreOffice worker) is planned for Phase 3.5.
    </div>
  );
}
