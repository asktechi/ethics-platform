"use client";

export function PlayerTimerRing({
  remaining,
  total,
  large = false,
}: {
  remaining: number;
  total: number;
  large?: boolean;
}) {
  const size = large ? 44 : 36;
  const r = large ? 18 : 14;
  const c = 2 * Math.PI * r;
  const pct = total <= 0 ? 0 : Math.max(0, Math.min(1, remaining / total));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(245,241,232,0.15)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#C9A227"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] tabular-nums text-gold">
        {remaining}
      </span>
    </div>
  );
}
