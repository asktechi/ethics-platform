"use client";

import { ThemeTile } from "@/components/theme/ThemeTile";
import { EmptyState } from "@/components/EmptyState";
import type { ThemeReelItem } from "@/lib/themes/types";

export function ThemeReel({
  items,
  onPin,
  limit = 6,
}: {
  items: ThemeReelItem[];
  onPin?: (item: ThemeReelItem) => void;
  limit?: number;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No slides to theme"
        description="Approve at least one derived slide, then shuffle professional palettes for this class."
      />
    );
  }

  const visible = limit ? items.slice(0, limit) : items;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <ThemeTile
            key={item.slide_id}
            item={item}
            onPin={onPin ? () => onPin(item) : undefined}
          />
        ))}
      </div>
      {limit && items.length > limit ? (
        <p className="text-xs text-ivory/50">
          Showing {limit} of {items.length} slides. Open Present → Preview to scrub the full reel.
        </p>
      ) : null}
    </div>
  );
}
