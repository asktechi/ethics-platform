"use client";

import type { SlideAssignment } from "@/lib/presentation/types";

/** Host chrome only — not an audience-facing slide renderer. */
export function SlideThumb({ slide }: { slide: SlideAssignment }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center px-4 text-center"
      style={{ backgroundColor: slide.theme.bg, color: slide.theme.text }}
    >
      <p className="font-display text-lg leading-snug">{slide.title || "Untitled slide"}</p>
    </div>
  );
}
