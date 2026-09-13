import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ModeBadge } from "@/components/games/ModeBadge";
import { coverColor, type GameMode } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export function GameCard({
  id,
  name,
  description,
  tags,
  mode,
  poolCount,
  playCount,
  lastPlayedAt,
  compact = false,
}: {
  id: string;
  name: string;
  description?: string | null;
  tags: string[];
  mode: GameMode;
  poolCount?: number | null;
  playCount: number;
  lastPlayedAt?: string | null;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/games/${id}`}
      className={cn(
        "group block border border-white/10 bg-card p-4 transition-colors hover:border-gold/70",
        compact && "min-w-[220px]",
      )}
    >
      <div className="mb-3 h-1.5 w-full" style={{ background: coverColor(id) }} />
      <ModeBadge mode={mode} />
      <h3 className="mt-2 font-display text-xl text-ivory group-hover:text-gold">{name}</h3>
      {description ? <p className="mt-1 line-clamp-1 text-sm text-ivory/55">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[11px] text-ivory/45">
            #{tag}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ivory/45">
        {poolCount != null ? `${poolCount} playable · ` : ""}
        {playCount} plays
        {lastPlayedAt ? ` · ${formatDistanceToNow(new Date(lastPlayedAt), { addSuffix: true })}` : ""}
      </p>
    </Link>
  );
}
