"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { sortLeaderboard } from "@/lib/quiz/scoring";
import { cn } from "@/lib/utils";

export type LivePlayer = {
  id: string;
  display_name: string;
  score: number;
  streak: number;
  avatar_color: string | null;
  connected?: boolean;
  last_correct_at?: string | null;
};

export function Leaderboard({
  players,
  changedIds,
  compact = false,
}: {
  players: LivePlayer[];
  changedIds?: Set<string>;
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const ranked = useMemo(() => sortLeaderboard(players), [players]);
  const limit = compact ? 5 : 10;
  const visible = showAll ? ranked : ranked.slice(0, limit);

  if (ranked.length === 0) {
    return <p className="px-3 py-6 text-sm text-ivory/45">Waiting for players to join…</p>;
  }

  return (
    <div>
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {visible.map((player, index) => {
            const rank = index + 1;
            const accent =
              rank === 1 ? "border-[#C9A227]" : rank === 2 ? "border-zinc-300/70" : rank === 3 ? "border-amber-700" : "border-white/10";
            return (
              <motion.li
                layout
                key={player.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: player.connected === false ? 0.45 : 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex items-center gap-2 border px-2 py-1.5 text-sm",
                  accent,
                  changedIds?.has(player.id) && "bg-gold/15",
                )}
              >
                <span className="w-5 text-xs text-ivory/50">{rank}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.avatar_color ?? "#C9A227" }} />
                <span className="min-w-0 flex-1 truncate">{player.display_name}</span>
                {player.streak > 1 ? <span className="text-[11px] text-orange-300">🔥{player.streak}</span> : null}
                <span className="tabular-nums text-gold">{player.score}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {ranked.length > limit && !showAll ? (
        <button type="button" className="mt-2 text-xs text-gold underline" onClick={() => setShowAll(true)}>
          Show all {ranked.length}
        </button>
      ) : null}
    </div>
  );
}
