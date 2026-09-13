import { MODE_META, type GameMode } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export function ModeBadge({ mode, className }: { mode: GameMode; className?: string }) {
  const meta = MODE_META[mode];
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]", className)}
      style={{ color: meta.accent, border: `1px solid ${meta.accent}66` }}
    >
      {meta.label}
      {!meta.playable ? <span className="normal-case tracking-normal text-ivory/40">6D</span> : null}
    </span>
  );
}
