"use client";

import Link from "next/link";
import { imageSourceLabel, imageSourceLine } from "@/lib/presentation/image-source";

type VisualSlide = {
  id: string;
  title: string | null;
  image_status?: string | null;
  image_preference?: string | null;
  stock_image_url?: string | null;
};

type Props = {
  classId: string;
  slides: VisualSlide[];
  curatedBySlide: Record<string, string | null>;
  imageUrls: Record<string, string>;
  monthSpend?: number;
  costEach: number;
};

export function SlideVisualsCard(props: Props) {
  return (
    <section className="border border-border bg-card p-5" data-slide-visuals="true">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Slide visuals</p>
      <p className="mt-2 text-sm text-ivory/70">
        Image source per slide: No image (gradient) | Stock | AI
      </p>
      <p className="mt-1 text-sm text-ivory/55">
        Each slide uses the theme gradient unless you choose a stock photo or an AI image in the
        deck editor. Generation is never automatic.
      </p>
      <Link
        href={`/class/${props.classId}/materials`}
        className="mt-3 inline-block text-sm text-gold underline-offset-4 hover:underline"
        data-open-deck-editor="true"
      >
        Open deck editor
      </Link>
      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto" data-image-source-list="true">
        {props.slides.map((slide) => {
          const label = imageSourceLabel({
            preference: (slide.image_preference as "auto" | "pool" | "ai" | "none") ?? "none",
            generatedUrl: props.imageUrls[slide.id],
            stockUrl: slide.stock_image_url,
            assignmentUrl: props.curatedBySlide[slide.id],
          });
          const thumb =
            label === "ai"
              ? props.imageUrls[slide.id]
              : label === "stock"
                ? (slide.stock_image_url ?? props.curatedBySlide[slide.id] ?? null)
                : null;
          return (
            <li key={slide.id} className="flex items-center gap-3 border border-white/10 p-2">
              <div className="h-12 w-16 shrink-0 overflow-hidden bg-navy">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.12em] text-ivory/50"
                    style={{
                      background:
                        "linear-gradient(148deg, #071018 0%, #0B1B2B 46%, #C9A22733 100%)",
                    }}
                  >
                    gradient
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ivory">{slide.title || "Untitled slide"}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-ivory/40">
                  {imageSourceLine(label)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] text-ivory/45">
        AI images ~${props.costEach.toFixed(2)} each
        {typeof props.monthSpend === "number"
          ? ` · this month $${props.monthSpend.toFixed(2)}`
          : ""}
      </p>
    </section>
  );
}
