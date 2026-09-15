"use client";

import { Button } from "@/components/ui/button";

export function RehearsalBanner({
  speed,
  ending,
  onEnd,
  onRestart,
  onSpeed,
}: {
  speed: 1 | 2 | 4;
  ending?: boolean;
  onEnd: () => void;
  onRestart: () => void;
  onSpeed: (next: 1 | 2 | 4) => void;
}) {
  const nextSpeed: 1 | 2 | 4 = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center gap-3 border-b border-amber-400/50 bg-amber-500/15 px-4 py-2 text-amber-100">
      <p className="text-sm font-medium">⚠ REHEARSAL MODE — no data will be saved.</p>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={ending} onClick={onEnd}>
          End rehearsal
        </Button>
        <Button size="sm" variant="outline" disabled={ending} onClick={onRestart}>
          Restart
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSpeed(nextSpeed)}>
          ⏩ Speed: {speed}x → {nextSpeed}x
        </Button>
      </div>
    </div>
  );
}
