"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameCard } from "@/components/games/GameCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { archiveGameAction } from "@/app/(app)/_actions/game.actions";
import { MODE_META, type GameMode } from "@/lib/games/types";
import type { GameTemplateRow } from "@/lib/data/games";

type SortKey = "recent" | "played" | "az" | "last";

export function GamesHub({
  templates,
  standards,
}: {
  templates: GameTemplateRow[];
  standards: Array<{ id: string; code: string }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GameMode | "all">("all");
  const [tag, setTag] = useState("all");
  const [standard, setStandard] = useState("all");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(templates.flatMap((row) => row.tags))], [templates]);
  const visible = useMemo(() => {
    const rows = templates.filter((row) => {
      const hidden = Boolean(row.deleted_at);
      if (archived ? !hidden : hidden) return false;
      if (mode !== "all" && row.mode !== mode) return false;
      if (tag !== "all" && !row.tags.includes(tag)) return false;
      if (standard !== "all" && !(row.standard_ids ?? []).includes(standard)) return false;
      if (difficulty !== "all" && !(row.difficulties ?? []).includes(difficulty)) return false;
      if (query && !`${row.name} ${row.description ?? ""} ${row.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "played") return b.play_count - a.play_count;
      if (sort === "last") return (b.last_played_at ?? "").localeCompare(a.last_played_at ?? "");
      return b.updated_at.localeCompare(a.updated_at);
    });
    return rows;
  }, [archived, difficulty, mode, query, sort, standard, tag, templates]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4 border border-white/10 bg-card p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Filters</p>
        <label className="block text-xs text-ivory/55">
          Mode
          <select
            className="mt-1 h-9 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameMode | "all")}
          >
            <option value="all">All modes</option>
            {(Object.keys(MODE_META) as GameMode[]).map((key) => (
              <option key={key} value={key}>
                {MODE_META[key].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ivory/55">
          Tag
          <select
            className="mt-1 h-9 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">All tags</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ivory/55">
          Standard coverage
          <select
            className="mt-1 h-9 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={standard}
            onChange={(event) => setStandard(event.target.value)}
          >
            <option value="all">Any standard</option>
            {standards.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ivory/55">
          Difficulty mix
          <select
            className="mt-1 h-9 w-full border border-border bg-navy px-2 text-sm text-ivory"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as "all" | "easy" | "medium" | "hard")}
          >
            <option value="all">Any difficulty</option>
            <option value="easy">Includes easy</option>
            <option value="medium">Includes medium</option>
            <option value="hard">Includes hard</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-ivory/70">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Show archived
        </label>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" className="max-w-xs" />
          <select
            className="h-10 border border-border bg-navy px-2 text-sm text-ivory"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="recent">Recent</option>
            <option value="played">Most played</option>
            <option value="az">A-Z</option>
            <option value="last">Recently played</option>
          </select>
        </div>

        {visible.length === 0 ? (
          templates.some((row) => (archived ? row.deleted_at : !row.deleted_at)) ? (
            <EmptyState
              title="No games match"
              description="Clear a filter or search term to see the rest of the library."
            />
          ) : (
          <EmptyState
            title="Build your first game →"
            description="Save a Jeopardy template once, then launch it without rebuilding the rules."
            action={
              <Button asChild className="bg-gold text-navy hover:bg-gold/90">
                <Link href="/games/new">Build your first game</Link>
              </Button>
            }
          />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <div key={row.id} className="space-y-2">
                <GameCard
                  id={row.id}
                  name={row.name}
                  description={row.description}
                  tags={row.tags}
                  mode={row.mode}
                  poolCount={row.pool_count}
                  playCount={row.play_count}
                  lastPlayedAt={row.last_played_at}
                />
                {archived && row.deleted_at ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === row.id}
                    onClick={() => {
                      setBusy(row.id);
                      void archiveGameAction(row.id, true)
                        .then(() => router.refresh())
                        .finally(() => setBusy(null));
                    }}
                  >
                    Restore
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GamesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-40 animate-pulse border border-white/10 bg-white/5" />
      ))}
    </div>
  );
}
