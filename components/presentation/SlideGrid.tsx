"use client";

import { dispatch, usePresentationBus } from "@/lib/presentation/bus";
import { SlideRenderer } from "@/components/presentation/SlideRenderer";

export function SlideGrid({ onClose }: { onClose: () => void }) {
  const assignments = usePresentationBus((s) => s.assignments);
  const current = usePresentationBus((s) => s.currentSlideIndex);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-navy/95 p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Jump to slide</p>
        <button type="button" className="text-xs text-ivory/60" onClick={onClose}>
          Close (G or Esc)
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3 xl:grid-cols-4">
        {assignments.map((slide, index) => (
          <button
            key={slide.slideId}
            type="button"
            onClick={() => {
              dispatch({ type: "GOTO", index });
              onClose();
            }}
            className={`overflow-hidden border text-left ${
              index === current ? "border-gold" : "border-white/10"
            }`}
          >
            <div className="aspect-video overflow-hidden">
              <div className="h-full w-full origin-top-left scale-[0.28] [width:358%] [height:358%]">
                <SlideRenderer
                  slide={slide}
                  theme={slide.theme}
                  imageUrl={slide.imageUrl}
                  imageAttribution={null}
                  layout={slide.layout}
                  mode="host"
                />
              </div>
            </div>
            <p className="truncate px-2 py-1.5 text-[11px] text-ivory/75">
              {index + 1}. {slide.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
