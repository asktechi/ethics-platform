"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ThemeReelItem } from "@/lib/themes/types";

export function ThemeTile({
  item,
  onPin,
}: {
  item: ThemeReelItem;
  onPin?: () => void;
}) {
  const angle = item.theme_json.gradientAngle ?? 160;
  const vignette = item.theme_json.vignette ?? 0.35;
  return (
    <div
      className="relative overflow-hidden border border-border"
      style={{
        background: `linear-gradient(${angle}deg, ${item.theme_json.bg} 0%, #05080c 100%)`,
        boxShadow: `inset 0 0 80px rgba(0,0,0,${vignette})`,
        color: item.theme_json.text,
      }}
    >
      {item.image_url ? (
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `url(${item.image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <div className="relative flex min-h-[160px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: item.theme_json.accent }}>
            {item.theme_name}
            {item.override ? " · pinned" : ""}
          </p>
          {onPin ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-ivory"
              onClick={onPin}
              aria-label="Pin theme to this slide"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <div>
          <h3 className="font-display text-lg leading-tight">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs opacity-80">{item.body || "No body yet."}</p>
        </div>
      </div>
    </div>
  );
}
