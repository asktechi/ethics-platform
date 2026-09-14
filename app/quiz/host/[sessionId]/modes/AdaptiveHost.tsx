"use client";

import { useEffect, useMemo, useState } from "react";
import { Leaderboard, type LivePlayer } from "@/components/quiz/Leaderboard";
import { Button } from "@/components/ui/button";
import type { HostExtraPanelProps } from "@/lib/games/modes/types";
import { createClient } from "@/lib/supabase/client";

type AdaptivePart = {
  answered_ids?: string[];
  current_standard_id?: string | null;
  last_standard_id?: string | null;
  streak?: number;
  question_index?: number;
};

export function AdaptiveHost({ sessionId, players, responses, modeConfig }: HostExtraPanelProps) {
  const total = Number(modeConfig.total_questions ?? 15);
  const [state, setState] = useState<Record<string, AdaptivePart>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const client = createClient();
    let cancelled = false;
    async function load() {
      const { data } = await client
        .from("game_instances")
        .select("id, adaptive_state")
        .eq("quiz_session_id", sessionId)
        .is("deleted_at", null)
        .maybeSingle();
      if (cancelled || !data) return;
      const per = ((data.adaptive_state as { per_participant?: Record<string, AdaptivePart> } | null)?.per_participant ??
        {}) as Record<string, AdaptivePart>;
      setState(per);
    }
    void load();
    const channel = client
      .channel(`adaptive-state:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_instances", filter: `quiz_session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { adaptive_state?: { per_participant?: Record<string, AdaptivePart> } };
          setState(row?.adaptive_state?.per_participant ?? {});
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [sessionId]);

  const standardIds = useMemo(
    () =>
      [
        ...new Set(
          Object.values(state)
            .map((part) => part.current_standard_id ?? part.last_standard_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    [state],
  );

  useEffect(() => {
    if (!standardIds.length) return;
    const client = createClient();
    void client
      .from("standards")
      .select("id, code, title")
      .in("id", standardIds)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        for (const row of data ?? []) next[row.id] = `${row.code} — ${row.title}`;
        setLabels(next);
      });
  }, [standardIds]);

  const top = [...players].sort((a, b) => b.score - a.score).slice(0, 8) as LivePlayer[];

  return (
    <section className="space-y-4">
      <div className="border border-[#4C8BF5]/40 bg-[#4C8BF5]/10 px-4 py-5">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4C8BF5]">Adaptive drill</p>
        <p className="mt-2 text-sm text-ivory/70">
          Players move independently. There is no shared question. End the session when the room is done.
        </p>
      </div>
      <ul className="space-y-2">
        {players.map((player) => {
          const part = state[player.id] ?? {};
          const standardId = part.current_standard_id ?? part.last_standard_id;
          const done = part.answered_ids?.length ?? responses.filter((row) => row.participant_id === player.id).length;
          return (
            <li key={player.id} className="border border-white/10 bg-card px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{player.display_name}</p>
                <p className="font-mono text-gold">{player.score} pts</p>
              </div>
              <p className="mt-1 text-sm text-ivory/65">
                {standardId ? `${player.display_name} is on ${labels[standardId] ?? "a Standard"}` : "Waiting for a question"}
              </p>
              <p className="text-xs text-ivory/45">
                {done} of {total} · streak {part.streak ?? player.streak}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="border border-white/10 bg-card p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-gold">Live scoreboard</p>
        <Leaderboard players={top} compact />
      </div>
      <Button variant="ghost" disabled>
        Next / Reveal disabled — players progress on their own
      </Button>
    </section>
  );
}
