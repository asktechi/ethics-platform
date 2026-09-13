"use client";

import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { PHASE46_SLIDES } from "@/lib/presentation/phase46-fixtures";

const slides = [
  { key: "A", slide: PHASE46_SLIDES.A, label: "Short" },
  { key: "B", slide: PHASE46_SLIDES.B, label: "Medium" },
  { key: "C", slide: PHASE46_SLIDES.C, label: "Long" },
  { key: "D", slide: PHASE46_SLIDES.D, label: "Single word" },
] as const;

export default function Phase46PreviewPage() {
  return (
    <main className="min-h-screen bg-[#050d14] p-4 text-ivory">
      <h1 className="px-2 font-display text-2xl">Phase 4.6 typography fixtures</h1>
      <p className="mt-1 px-2 text-sm text-ivory/60">
        Canonical 1920×1080 pagination, scaled into each tile. Reveal is fully open.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {slides.map(({ key, slide, label }) => (
          <section key={key} className="border border-white/10">
            <p className="bg-[#071018] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-gold">
              Slide {key} — {label}
            </p>
            <div className="relative h-[48vh] min-h-[320px]">
              <AudienceMirror
                slide={slide}
                beat={0}
                theme={slide.theme}
                imageUrl={null}
                imageAttribution={null}
                revealLineCount={-1}
                showChrome={false}
              />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
