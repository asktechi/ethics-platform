"use client";

import { Button } from "@/components/ui/button";

export type BestAnswer = {
  display_name: string;
  avatar_color: string | null;
  ms_taken: number;
  points: number;
};

export function BestAnswerPanel({
  best,
  onShow,
}: {
  best: BestAnswer | null;
  onShow?: () => void;
}) {
  if (!best) {
    return <p className="text-xs text-ivory/45">No correct answers this round.</p>;
  }
  return (
    <div className="border border-gold/40 bg-gold/5 p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Fastest correct answer</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: best.avatar_color ?? "#C9A227" }} />
        <p className="font-display text-lg text-ivory">{best.display_name}</p>
      </div>
      <p className="mt-1 text-sm text-ivory/70">
        {(best.ms_taken / 1000).toFixed(1)}s · {best.points} pts
      </p>
      {onShow ? (
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onShow}>
          Show on screen
        </Button>
      ) : null}
    </div>
  );
}
