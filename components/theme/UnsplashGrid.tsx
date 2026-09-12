"use client";

import { cn } from "@/lib/utils";
import type { UnsplashImage } from "@/lib/integrations/unsplash.types";

export function UnsplashGrid({
  images,
  selectedIds,
  onToggle,
}: {
  images: UnsplashImage[];
  selectedIds: Set<string>;
  onToggle: (image: UnsplashImage) => void;
}) {
  if (images.length === 0) {
    return <p className="text-sm text-ivory/55">No images yet. Search or regenerate.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image) => {
        const selected = selectedIds.has(image.id);
        return (
          <button
            key={image.id}
            type="button"
            onClick={() => onToggle(image)}
            className={cn(
              "relative aspect-[4/3] overflow-hidden border",
              selected ? "border-gold ring-2 ring-gold/50" : "border-border",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.thumb_url || image.url}
              alt={`Photo by ${image.photographer}`}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 bg-navy/80 px-2 py-1 text-[10px] text-ivory">
              {image.photographer}
            </span>
          </button>
        );
      })}
    </div>
  );
}
