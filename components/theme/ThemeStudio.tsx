"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  loadThemeStudioAction,
  pinThemeAction,
  reshuffleAction,
} from "@/app/(app)/_actions/theme.actions";
import { ConceptImagePoolPanel } from "@/components/theme/ConceptImagePoolPanel";
import { MissingApiKeyNotice } from "@/components/theme/MissingApiKeyNotice";
import { ThemeReel } from "@/components/theme/ThemeReel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImagePoolWithItems } from "@/lib/data/image-pools.types";
import type { ThemeReelItem } from "@/lib/themes/types";
import type { Concept, PresentationRun } from "@/types/db.helpers";
import type { Json } from "@/types/db";

type ThemeOption = { id: string; name: string; palette_json: Json };

export function ThemeStudio({ classId }: { classId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<PresentationRun | null>(null);
  const [reel, setReel] = useState<ThemeReelItem[]>([]);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [pools, setPools] = useState<ImagePoolWithItems[]>([]);
  const [unsplashConfigured, setUnsplashConfigured] = useState(true);
  const [pinItem, setPinItem] = useState<ThemeReelItem | null>(null);

  const reload = useCallback(() => {
    startTransition(async () => {
      const result = await loadThemeStudioAction({ classId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setRun(result.run);
      setReel(result.reel);
      setThemes(result.themes as ThemeOption[]);
      setConcepts(result.concepts);
      setPools(result.pools);
      setUnsplashConfigured(result.unsplashConfigured);
    });
  }, [classId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Run preview
            </p>
            <h2 className="mt-1 font-display text-2xl text-ivory">Palette shuffle</h2>
            <p className="mt-1 text-sm text-ivory/60">
              Professional themes only. A class never reuses the last five theme
              slots from a prior run.
            </p>
          </div>
          <Button
            type="button"
            disabled={pending || !run}
            onClick={() => {
              if (!run) return;
              startTransition(async () => {
                const result = await reshuffleAction({ classId, runId: run.id });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setReel(result.reel);
              });
            }}
          >
            Re-shuffle
          </Button>
        </div>
        <ThemeReel items={reel} onPin={setPinItem} />
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Concept image pools
          </p>
          <h2 className="mt-1 font-display text-2xl text-ivory">Locked backgrounds</h2>
        </div>
        {!unsplashConfigured ? <MissingApiKeyNotice /> : null}
        <ConceptImagePoolPanel
          classId={classId}
          concepts={concepts}
          pools={pools}
          unsplashConfigured={unsplashConfigured}
          onChanged={reload}
        />
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <Dialog open={Boolean(pinItem)} onOpenChange={(open) => !open && setPinItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pin a theme to this slide</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((theme) => {
              const palette = theme.palette_json as { bg?: string; accent?: string };
              return (
                <button
                  key={theme.id}
                  type="button"
                  className="border border-border px-3 py-4 text-left text-sm text-ivory"
                  style={{ background: palette.bg ?? "#0B1B2B" }}
                  onClick={() => {
                    if (!run || !pinItem) return;
                    startTransition(async () => {
                      const result = await pinThemeAction({
                        classId,
                        runId: run.id,
                        slideId: pinItem.slide_id,
                        themeId: theme.id,
                      });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setPinItem(null);
                      reload();
                    });
                  }}
                >
                  <span className="block text-xs" style={{ color: palette.accent ?? "#C9A227" }}>
                    {theme.name}
                  </span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPinItem(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
