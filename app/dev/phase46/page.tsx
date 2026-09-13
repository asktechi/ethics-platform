"use client";

import { useMemo, useState } from "react";
import { AudienceMirror } from "@/components/presentation/AudienceMirror";
import { PHASE46_SLIDES } from "@/lib/presentation/phase46-fixtures";

const slides = [
  { key: "A", slide: PHASE46_SLIDES.A, label: "Short — dog sentence" },
  { key: "B", slide: PHASE46_SLIDES.B, label: "Medium" },
  { key: "C", slide: PHASE46_SLIDES.C, label: "Long — 12 sentences" },
  { key: "D", slide: PHASE46_SLIDES.D, label: "Single word" },
  { key: "L", slide: PHASE46_SLIDES.long, label: "Long — ~200 words" },
] as const;

export default function Phase46PreviewPage() {
  const [active, setActive] = useState<(typeof slides)[number]["key"]>("A");
  const current = useMemo(() => slides.find((item) => item.key === active) ?? slides[0], [active]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050d14] text-ivory">
      <div className="pointer-events-auto absolute left-3 top-3 z-30 flex flex-wrap gap-2">
        {slides.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActive(item.key)}
            className={`px-2 py-1 text-[11px] uppercase tracking-[0.14em] ${
              item.key === active ? "bg-gold text-navy" : "bg-black/40 text-ivory/80"
            }`}
          >
            {item.key} · {item.label}
          </button>
        ))}
      </div>
      <AudienceMirror
        slide={current.slide}
        beat={0}
        theme={current.slide.theme}
        imageUrl={null}
        imageAttribution={null}
        revealLineCount={-1}
        showChrome={false}
      />
    </main>
  );
}
