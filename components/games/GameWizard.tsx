"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { previewGameSourceAction, saveGameAction, updateGameAction } from "@/app/(app)/_actions/game.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResolveDiagnostics } from "@/lib/games/resolve";
import { getMode } from "@/lib/games/modes/registry";
import { schemaDefaults } from "@/lib/games/modes/types";
import { MODE_META, type GameMode } from "@/lib/games/types";
import { useGameWizard } from "@/lib/games/wizard-store";
import { cn } from "@/lib/utils";

type PoolOption = { id: string; name: string; count: number; stems: string[] };
type ClassOption = { id: string; title: string };
type CaseOption = { id: string; title: string; questionCount: number; preview: string };
type PreviewState = {
  count: number;
  sample: string[];
  diagnostics: ResolveDiagnostics;
};

const COMING_SOON = "This mode is coming soon. Save a playable mode for now.";

export function GameWizard({
  classes,
  poolsByClass,
  standards,
  conceptsByClass,
  casesByClass = {},
  existingTags,
  editId,
}: {
  classes: ClassOption[];
  poolsByClass: Record<string, PoolOption[]>;
  standards: Array<{ id: string; code: string; title: string }>;
  conceptsByClass: Record<string, Array<{ id: string; title: string }>>;
  casesByClass?: Record<string, CaseOption[]>;
  existingTags: string[];
  editId?: string;
}) {
  const router = useRouter();
  const store = useGameWizard();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepToast, setStepToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [tagDraft, setTagDraft] = useState(store.tags.join(", "));

  useEffect(() => {
    if (!store.classId && classes[0]) store.patch({ classId: classes[0].id });
  }, [classes, store]);

  const pools = poolsByClass[store.classId] ?? [];
  const concepts = conceptsByClass[store.classId] ?? [];
  const cases = casesByClass[store.classId] ?? [];
  const selectedPool = pools.find((item) => item.id === store.poolId);
  const caseStudyIds = store.caseStudyIds ?? [];
  const modeDef = getMode(store.mode);
  const config = store.modeConfig ?? schemaDefaults(modeDef.configSchema);

  useEffect(() => {
    if (!store.classId) return;
    if (store.source === "pool" && !store.poolId && store.mode !== "case_study") {
      setPreview(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void previewGameSourceAction({
        classId: store.classId,
        source: store.mode === "case_study" ? "cases" : store.source,
        poolId: store.poolId,
        filter: store.filter,
        mode: store.mode,
        caseStudyIds: store.caseStudyIds,
      }).then((result) => {
        if (result.ok) {
          setPreview({
            count: result.count,
            sample: result.sample,
            diagnostics: result.diagnostics,
          });
        }
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [store.classId, store.filter, store.poolId, store.source, store.mode, store.caseStudyIds]);

  const canNext = useMemo(() => {
    if (store.step === 1) return Boolean(store.name.trim() && store.classId);
    if (store.step === 2) {
      if (store.mode === "case_study") return caseStudyIds.length >= 1;
      return store.source === "filter" || Boolean(store.poolId);
    }
    if (store.step === 3 && store.mode === "case_study") return caseStudyIds.length >= 1;
    return true;
  }, [store, caseStudyIds.length]);

  function goNext() {
    if (store.step === 2 && store.mode !== "case_study" && (preview?.count ?? 0) === 0) {
      setStepToast("Add questions before continuing.");
      return;
    }
    if (store.step === 2 && store.mode === "case_study" && caseStudyIds.length === 0) {
      setStepToast("Pick at least one case.");
      return;
    }
    setStepToast(null);
    store.setStep(store.step + 1);
  }

  function submit() {
    setError(null);
    if ((preview?.count ?? 0) === 0) {
      setError("This game has 0 playable questions. Go back to Step 2 and fix the source.");
      return;
    }
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
        modeConfig: store.modeConfig,
        caseStudyIds: store.caseStudyIds ?? [],
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
          {store.mode === "case_study" ? (
            <CasePicker
              cases={cases}
              selected={caseStudyIds}
              onChange={(ids) => store.patch({ caseStudyIds: ids })}
            />
          ) : (
            <>
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
              {pools.length === 0 ? (
                <p className="mb-3 text-sm text-ivory/60">
                  This class has no pools yet. Open the class Questions tab, check items, click{" "}
                  <strong>Add to pool</strong>, then come back.
                </p>
              ) : null}
              <select
                className="h-10 w-full border border-border bg-navy px-2 text-sm"
                value={store.poolId}
                onChange={(event) => store.patch({ poolId: event.target.value })}
              >
                <option value="">Select a pool</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
              {selectedPool && !preview ? (
                <p className="mt-3 text-sm text-ivory/50">Resolving pool…</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
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
            </>
          )}
          <SourcePreview source={store.mode === "case_study" ? "cases" : store.source} preview={preview} />
        </section>
      ) : null}

      {store.step === 3 ? (
        <section className="mt-8">
          <h1 className="font-display text-3xl">Mode</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(MODE_META) as GameMode[]).map((mode) => {
              const meta = MODE_META[mode];
              if (!meta.playable) {
                return (
                  <div
                    key={mode}
                    title={COMING_SOON}
                    className="pointer-events-none relative cursor-not-allowed border border-white/10 p-4 text-left opacity-60"
                  >
                    <span className="absolute right-2 top-2 bg-[#E63946] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ivory">
                      Coming soon
                    </span>
                    <p className="font-display text-lg" style={{ color: meta.accent }}>
                      {meta.label}
                    </p>
                    <p className="mt-1 text-sm text-ivory/60">{meta.blurb}</p>
                  </div>
                );
              }
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    store.patch({
                      mode,
                      modeConfig: schemaDefaults(getMode(mode).configSchema),
                    })
                  }
                  className={cn(
                    "border p-4 text-left hover:border-gold/70",
                    store.mode === mode ? "border-gold bg-gold/10" : "border-white/15",
                  )}
                >
                  <p className="font-display text-lg" style={{ color: meta.accent }}>
                    {meta.label}
                  </p>
                  <p className="mt-1 text-sm text-ivory/60">{meta.blurb}</p>
                </button>
              );
            })}
          </div>
          {store.mode === "case_study" ? (
            <div className="mt-6">
              <CasePicker
                cases={cases}
                selected={caseStudyIds}
                onChange={(ids) => store.patch({ caseStudyIds: ids })}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {store.step === 4 ? (
        <section className="mt-8 space-y-3">
          <h1 className="font-display text-3xl">Rules</h1>
          {modeDef.configSchema.map((field) => {
            const value = config[field.key] ?? field.default;
            if (field.key === "team_assignment_mode") {
              return (
                <Field key={field.key} label={field.label}>
                  <select
                    className="h-10 w-full border border-border bg-navy px-2 text-sm"
                    value={String(value)}
                    onChange={(event) =>
                      store.patch({ modeConfig: { ...config, [field.key]: event.target.value } })
                    }
                  >
                    <option value="auto">Auto (round-robin on join)</option>
                    <option value="manual">Manual (host assigns in lobby)</option>
                    <option value="self_select">Players pick a team</option>
                  </select>
                </Field>
              );
            }
            if (field.type === "boolean") {
              return (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) =>
                      store.patch({ modeConfig: { ...config, [field.key]: event.target.checked } })
                    }
                  />
                  {field.label}
                </label>
              );
            }
            return (
              <Field key={field.key} label={field.label}>
                <Input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={Number(value)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    store.patch({
                      modeConfig: { ...config, [field.key]: next },
                      settings:
                        field.key === "time_per_q" || field.key === "base_points"
                          ? {
                              ...store.settings,
                              ...(field.key === "time_per_q" ? { time_per_q: next } : { base_points: next }),
                            }
                          : store.settings,
                    });
                  }}
                />
              </Field>
            );
          })}
          {(
            [
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
          {(preview?.count ?? 0) === 0 ? (
            <p className="border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              This game has 0 playable questions. Go back to Step 2 and fix the source.
            </p>
          ) : (
            <p className="text-sm text-ivory/60">{preview?.count} playable questions (same resolver as launch).</p>
          )}
          <ul className="space-y-1 text-sm text-ivory/70">
            {(preview?.sample ?? []).map((stem) => (
              <li key={stem}>{stem}</li>
            ))}
          </ul>
          <p className="text-sm text-ivory/55">
            Estimated length:{" "}
            {store.mode === "rapid_fire"
              ? `${Number(config.total_time_seconds ?? 60)} seconds on a shared clock.`
              : `${((((preview?.count ?? 0) * store.settings.time_per_q) / 60 + 0.5 * (preview?.count ?? 0))).toFixed(1)} minutes including reveal buffer.`}
          </p>
        </section>
      ) : null}

      {stepToast ? <p className="mt-4 text-sm text-gold">{stepToast}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-8 flex gap-2">
        <Button variant="outline" disabled={store.step === 1} onClick={() => store.setStep(store.step - 1)}>
          Back
        </Button>
        {store.step < 5 ? (
          <Button className="bg-gold text-navy hover:bg-gold/90" disabled={!canNext} onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            className="bg-gold text-navy hover:bg-gold/90"
            disabled={pending || (preview?.count ?? 0) === 0}
            onClick={submit}
          >
            {pending ? "Saving…" : editId ? "Save changes" : "Save Game"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CasePicker({
  cases,
  selected,
  onChange,
}: {
  cases: CaseOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const total = cases.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.questionCount, 0);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl">Pick cases</h2>
      {cases.length === 0 ? (
        <p className="text-sm text-ivory/60">
          This class has no case studies yet. Open the class Cases page, attach questions, then come back.
        </p>
      ) : (
        <div className="space-y-2">
          {cases.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label key={item.id} className="flex items-start gap-3 border border-white/10 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={(event) => {
                    onChange(
                      event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id),
                    );
                  }}
                />
                <span>
                  <span className="block font-medium text-ivory">{item.title}</span>
                  <span className="block text-ivory/55">{item.questionCount} questions · {item.preview}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      <p className="text-sm text-gold">
        {selected.length} case{selected.length === 1 ? "" : "s"} · {total} questions
      </p>
      {selected.length === 0 ? <p className="text-sm text-red-300">Pick at least one case.</p> : null}
    </div>
  );
}

function SourcePreview({ source, preview }: { source: "pool" | "filter" | "cases"; preview: PreviewState | null }) {
  if (!preview) {
    return (
      <div className="border border-white/10 bg-card/40 p-3 text-sm text-ivory/50">
        Preview will appear after you pick a source.
      </div>
    );
  }
  const { diagnostics, count, sample } = preview;
  return (
    <div className="border border-white/10 bg-card/40 p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Preview</p>
      {source === "pool" ? (
        <p className="mt-2 text-sm text-ivory/70">
          {diagnostics.approvedCount} of {diagnostics.poolItemCount} approved
        </p>
      ) : source === "cases" ? (
        <p className="mt-2 text-sm text-ivory/70">Selected cases have {count} playable questions.</p>
      ) : (
        <p className="mt-2 text-sm text-ivory/70">This filter matches {diagnostics.filterMatchCount} questions.</p>
      )}
      {count === 0 ? (
        <p className="mt-2 text-sm text-red-300">
          {source === "filter" ? "No questions match this filter. Adjust it." : "No playable questions in this pool."}
        </p>
      ) : count < 5 ? (
        <p className="mt-2 text-sm text-amber-300">Only {count} questions match — consider broadening.</p>
      ) : (
        <p className="mt-2 text-sm text-ivory/70">{count} playable questions.</p>
      )}
      {source === "filter" && diagnostics.filterMatchCount > 0 && diagnostics.approvedCount === 0 ? (
        <p className="mt-2 text-sm text-red-300">
          {diagnostics.filterMatchCount} match but 0 are approved. Approve them first.
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm text-ivory/55">
        {sample.map((stem) => (
          <li key={stem} className="truncate">
            · {stem}
          </li>
        ))}
      </ul>
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
