"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { countFilterAction, saveGameAction, updateGameAction } from "@/app/(app)/_actions/game.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MODE_META, type GameMode } from "@/lib/games/types";
import { useGameWizard } from "@/lib/games/wizard-store";
import { cn } from "@/lib/utils";

type PoolOption = { id: string; name: string; count: number; stems: string[] };
type ClassOption = { id: string; title: string };

export function GameWizard({
  classes,
  poolsByClass,
  standards,
  conceptsByClass,
  existingTags,
  editId,
}: {
  classes: ClassOption[];
  poolsByClass: Record<string, PoolOption[]>;
  standards: Array<{ id: string; code: string; title: string }>;
  conceptsByClass: Record<string, Array<{ id: string; title: string }>>;
  existingTags: string[];
  editId?: string;
}) {
  const router = useRouter();
  const store = useGameWizard();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [tagDraft, setTagDraft] = useState(store.tags.join(", "));

  useEffect(() => {
    if (!store.classId && classes[0]) store.patch({ classId: classes[0].id });
  }, [classes, store]);

  const pools = poolsByClass[store.classId] ?? [];
  const concepts = conceptsByClass[store.classId] ?? [];
  const selectedPool = pools.find((item) => item.id === store.poolId);

  useEffect(() => {
    if (store.source !== "filter" || !store.classId) return;
    const timer = window.setTimeout(() => {
      void countFilterAction(store.classId, store.filter).then((result) => {
        if (result.ok) setMatchCount(result.count);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [store.classId, store.filter, store.source]);

  const canNext = useMemo(() => {
    if (store.step === 1) return Boolean(store.name.trim() && store.classId);
    if (store.step === 2) return store.source === "filter" || Boolean(store.poolId);
    return true;
  }, [store]);

  function submit() {
    setError(null);
    start(async () => {
      const payload = {
        classId: store.classId,
        name: store.name,
        description: store.description,
        tags: store.tags,
        source: store.source,
        poolId: store.poolId,
        filter: store.filter,
        mode: store.mode,
        settings: store.settings,
      };
      const result = editId ? await updateGameAction(editId, payload) : await saveGameAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      store.reset();
      if (editId && "version" in result) {
        router.push(`/games/${editId}?saved=1&version=${result.version}`);
        return;
      }
      if ("id" in result) router.push(`/games/${result.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-[0.16em] text-gold">Step {store.step} of 5</p>
      <div className="mt-2 h-1 bg-white/10">
        <div className="h-full bg-gold" style={{ width: `${(store.step / 5) * 100}%` }} />
      </div>

      {store.step === 1 ? (
        <section className="mt-8 space-y-4">
          <h1 className="font-display text-3xl">Basics</h1>
          <Field label="Class">
            <select
              className="h-10 w-full border border-border bg-navy px-2 text-sm"
              value={store.classId}
              onChange={(event) => store.patch({ classId: event.target.value, poolId: "" })}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <Input value={store.name} onChange={(event) => store.patch({ name: event.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea value={store.description} onChange={(event) => store.patch({ description: event.target.value })} />
          </Field>
          <Field label="Tags">
            <Input
              value={tagDraft}
              onChange={(event) => {
                setTagDraft(event.target.value);
                store.patch({
                  tags: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                });
              }}
              placeholder="ethics, independence, gifts"
            />
            {existingTags.length ? (
              <p className="mt-1 text-xs text-ivory/40">Existing: {existingTags.slice(0, 12).join(", ")}</p>
            ) : null}
          </Field>
        </section>
      ) : null}

      {store.step === 2 ? (
        <section className="mt-8 space-y-4">
          <h1 className="font-display text-3xl">Question source</h1>
          <div className="flex gap-3">
            {(["pool", "filter"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => store.patch({ source })}
                className={cn(
                  "flex-1 border px-3 py-3 text-left",
                  store.source === source ? "border-gold bg-gold/10" : "border-white/15",
                )}
              >
                {source === "pool" ? "Use an existing pool" : "Build a filter"}
              </button>
            ))}
          </div>
          {store.source === "pool" ? (
            <div>
              <select
                className="h-10 w-full border border-border bg-navy px-2 text-sm"
                value={store.poolId}
                onChange={(event) => store.patch({ poolId: event.target.value })}
              >
                <option value="">Select a pool</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} ({pool.count})
                  </option>
                ))}
              </select>
              {selectedPool ? (
                <ul className="mt-3 space-y-1 text-sm text-ivory/60">
                  <li>{selectedPool.count} questions</li>
                  {selectedPool.stems.map((stem) => (
                    <li key={stem} className="truncate">
                      · {stem}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ivory/60">Live match: {matchCount ?? "…"} questions</p>
              <div>
                <p className="text-xs uppercase text-gold">Standards</p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {standards.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={store.filter.standards.includes(item.id)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...store.filter.standards, item.id]
                            : store.filter.standards.filter((id) => id !== item.id);
                          store.patch({ filter: { ...store.filter, standards: next } });
                        }}
                      />
                      {item.code} {item.title}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase text-gold">Concepts</p>
                <div className="mt-2 max-h-40 overflow-auto space-y-1">
                  {concepts.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={store.filter.concepts.includes(item.id)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...store.filter.concepts, item.id]
                            : store.filter.concepts.filter((id) => id !== item.id);
                          store.patch({ filter: { ...store.filter, concepts: next } });
                        }}
                      />
                      {item.title}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {(["easy", "medium", "hard"] as const).map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={store.filter.difficulty.includes(item)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...store.filter.difficulty, item]
                          : store.filter.difficulty.filter((value) => value !== item);
                        store.patch({ filter: { ...store.filter, difficulty: next } });
                      }}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {(["imported", "ai_generated", "mine"] as const).map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={store.filter.sources.includes(item)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...store.filter.sources, item]
                          : store.filter.sources.filter((value) => value !== item);
                        store.patch({ filter: { ...store.filter, sources: next } });
                      }}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={store.filter.approved_only}
                  onChange={(event) => store.patch({ filter: { ...store.filter, approved_only: event.target.checked } })}
                />
                Approved only
              </label>
            </div>
          )}
        </section>
      ) : null}

      {store.step === 3 ? (
        <section className="mt-8">
          <h1 className="font-display text-3xl">Mode</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(MODE_META) as GameMode[]).map((mode) => {
              const meta = MODE_META[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => store.patch({ mode })}
                  className={cn(
                    "border p-4 text-left hover:border-gold/70",
                    store.mode === mode ? "border-gold bg-gold/10" : "border-white/15",
                  )}
                >
                  <p className="font-display text-lg" style={{ color: meta.accent }}>
                    {meta.label}
                  </p>
                  <p className="mt-1 text-sm text-ivory/60">{meta.blurb}</p>
                  {!meta.playable ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ivory/40">Coming in Phase 6D</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {store.step === 4 ? (
        <section className="mt-8 space-y-3">
          <h1 className="font-display text-3xl">Rules</h1>
          {store.mode !== "jeopardy" ? (
            <p className="text-sm text-ivory/55">Rules for this mode land in Phase 6D. Jeopardy fields are stored for now.</p>
          ) : null}
          <Field label="Seconds per question">
            <Input
              type="number"
              min={5}
              max={300}
              value={store.settings.time_per_q}
              onChange={(event) =>
                store.patch({ settings: { ...store.settings, time_per_q: Number(event.target.value) } })
              }
            />
          </Field>
          <Field label="Base points">
            <Input
              type="number"
              value={store.settings.base_points}
              onChange={(event) =>
                store.patch({ settings: { ...store.settings, base_points: Number(event.target.value) } })
              }
            />
          </Field>
          {(
            [
              ["time_bonus", "Time bonus"],
              ["streak_bonus", "Streak bonus"],
              ["shuffle_questions", "Shuffle questions"],
              ["show_leaderboard_to_players", "Show leaderboard to players"],
              ["show_correct_answer_after", "Show correct answer after each question"],
              ["allow_late_join", "Allow late join"],
              ["allow_audience_advance", "Allow audience advance"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={store.settings[key]}
                onChange={(event) => store.patch({ settings: { ...store.settings, [key]: event.target.checked } })}
              />
              {label}
            </label>
          ))}
        </section>
      ) : null}

      {store.step === 5 ? (
        <section className="mt-8 space-y-3">
          <h1 className="font-display text-3xl">Preview</h1>
          <p className="text-sm text-ivory/60">
            {store.source === "pool"
              ? `${selectedPool?.count ?? 0} questions from ${selectedPool?.name ?? "the selected pool"}`
              : `${matchCount ?? 0} questions match the filter (re-evaluated on launch).`}
          </p>
          <ul className="space-y-1 text-sm text-ivory/70">
            {(selectedPool?.stems ?? []).slice(0, 5).map((stem) => (
              <li key={stem}>{stem}</li>
            ))}
          </ul>
          <p className="text-sm text-ivory/55">
            Estimated length:{" "}
            {(((selectedPool?.count ?? matchCount ?? 0) * store.settings.time_per_q) / 60 + 0.5 * (selectedPool?.count ?? matchCount ?? 0)).toFixed(1)}{" "}
            minutes including reveal buffer.
          </p>
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-8 flex gap-2">
        <Button variant="outline" disabled={store.step === 1} onClick={() => store.setStep(store.step - 1)}>
          Back
        </Button>
        {store.step < 5 ? (
          <Button className="bg-gold text-navy hover:bg-gold/90" disabled={!canNext} onClick={() => store.setStep(store.step + 1)}>
            Next
          </Button>
        ) : (
          <Button className="bg-gold text-navy hover:bg-gold/90" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : editId ? "Save changes" : "Save Game"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-ivory/70">{label}</Label>
      {children}
    </div>
  );
}
