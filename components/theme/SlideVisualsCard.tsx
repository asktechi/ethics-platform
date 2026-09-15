"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type VisualSlide = {
  id: string;
  title: string | null;
  image_status?: string | null;
  image_preference?: string | null;
};

type Props = {
  classId: string;
  publicRunId: string | null;
  slides: VisualSlide[];
  curatedBySlide: Record<string, string | null>;
  imageUrls: Record<string, string>;
  spend: number;
  imageToday: { count: number; spend: number };
  costEach: number;
  autoGenerate: boolean;
  onAutoGenerateChange: (next: boolean) => void;
};

export function SlideVisualsCard(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState(props.imageUrls);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ ready: number; total: number } | null>(null);

  const missing = useMemo(() => {
    return props.slides.filter((slide) => {
      if (slide.image_preference === "none" || slide.image_preference === "pool") return false;
      if (urls[slide.id] || slide.image_status === "ready") return false;
      if (props.curatedBySlide[slide.id] && slide.image_preference !== "ai") return false;
      return true;
    });
  }, [props.curatedBySlide, props.slides, urls]);

  const readyCount = props.slides.length - missing.length;
  const estimate = (missing.length * props.costEach).toFixed(2);

  async function generateOne(slideId: string, regenerate = false) {
    setBusyId(slideId);
    setError(null);
    const path = regenerate
      ? `/api/slides/${slideId}/regenerate-image`
      : `/api/slides/${slideId}/generate-image`;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = (await response.json()) as { url?: string; error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(json.error ?? "Generation failed");
      return;
    }
    if (json.url) setUrls((prev) => ({ ...prev, [slideId]: json.url as string }));
  }

  function generateDeck() {
    if (!props.publicRunId) return;
    startTransition(async () => {
      setError(null);
      let remaining = missing.length;
      let ready = readyCount;
      setProgress({ ready, total: props.slides.length });
      while (remaining > 0) {
        const response = await fetch(`/api/present/${props.publicRunId}/preload-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 1 }),
        });
        const json = (await response.json()) as {
          remaining?: number;
          ready?: number;
          error?: string;
          done?: boolean;
          results?: Array<{ slideId: string; url: string }>;
        };
        if (!response.ok) {
          setError(json.error ?? "Preload failed");
          break;
        }
        remaining = json.remaining ?? 0;
        ready = json.ready ?? ready + 1;
        setProgress({ ready, total: props.slides.length });
        if (json.results?.length) {
          setUrls((prev) => {
            const next = { ...prev };
            for (const row of json.results ?? []) next[row.slideId] = row.url;
            return next;
          });
        }
        if (json.done) break;
      }
    });
  }

  return (
    <section className="border border-border bg-card p-5" data-slide-visuals="true">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Slide visuals</p>
      <p className="mt-2 text-sm text-ivory/70">
        AI images fill slides that have no curated pool photo. Generation is opt-in.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-ivory">
        <input
          type="checkbox"
          checked={props.autoGenerate}
          onChange={(event) => props.onAutoGenerateChange(event.target.checked)}
        />
        Auto-generate images for slides without curated pool
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || !props.publicRunId} onClick={generateDeck}>
          Generate now for this deck
        </Button>
        <p className="text-xs text-ivory/55">
          ~${estimate} for {missing.length} slides at ${props.costEach.toFixed(2)} each
        </p>
      </div>
      {progress ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ivory/50">
            {progress.ready} of {progress.total} slides ready
          </p>
          <div className="mt-2 h-1.5 w-full bg-white/10">
            <div
              className="h-full bg-gold"
              style={{ width: `${Math.min(100, (progress.ready / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ivory/50">
          {readyCount} of {props.slides.length} slides ready
        </p>
      )}
      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {props.slides.map((slide) => {
          const thumb = urls[slide.id] ?? props.curatedBySlide[slide.id] ?? null;
          return (
            <li key={slide.id} className="flex items-center gap-3 border border-white/10 p-2">
              <div className="h-12 w-16 shrink-0 overflow-hidden bg-navy">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[9px] uppercase text-ivory/35">
                    none
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ivory">{slide.title || "Untitled slide"}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-ivory/40">
                  {slide.image_status ?? "none"}
                  {props.curatedBySlide[slide.id] ? " · pool" : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busyId === slide.id}
                onClick={() => void generateOne(slide.id, Boolean(urls[slide.id]))}
              >
                {busyId === slide.id ? "Working…" : urls[slide.id] ? "Regenerate" : "Generate"}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] text-ivory/45">
        Class AI spend ${props.spend.toFixed(2)} · images today {props.imageToday.count} ($
        {props.imageToday.spend.toFixed(2)})
      </p>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
