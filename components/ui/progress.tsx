"use client";

import { cn } from "@/lib/utils";

export function Progress({
  value = 0,
  className,
}: {
  value?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-navy/60", className)}
    >
      <div
        className="h-full bg-gold transition-[width] duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
