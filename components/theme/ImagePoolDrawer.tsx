"use client";

import { useMemo, useState, useTransition } from "react";
import {
  lockImagePoolAction,
  regeneratePoolAction,
  searchUnsplashAction,
} from "@/app/(app)/_actions/theme.actions";
import { MissingApiKeyNotice } from "@/components/theme/MissingApiKeyNotice";
import { UnsplashGrid } from "@/components/theme/UnsplashGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { UnsplashImage } from "@/lib/integrations/unsplash.types";
import type { ImagePoolWithItems } from "@/lib/data/image-pools.types";

export function ImagePoolDrawer({
  classId,
  conceptId,
  conceptTitle,
  pool,
  unsplashConfigured,
  open,
  onOpenChange,
  onChanged,
}: {
  classId: string;
  conceptId: string;
  conceptTitle: string;
  pool: ImagePoolWithItems | null;
  unsplashConfigured: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(conceptTitle);
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [selected, setSelected] = useState<Record<string, UnsplashImage>>({});
  const [error, setError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(!unsplashConfigured);

  const selectedIds = useMemo(() => new Set(Object.keys(selected)), [selected]);

  function search() {
    startTransition(async () => {
      const result = await searchUnsplashAction({ query, count: 24 });
      if (!result.ok) {
        setMissingKey(Boolean(result.missingKey));
        setError(result.error);
        return;
      }
      setError(null);
      setImages(result.images);
    });
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regeneratePoolAction({
        conceptId,
        keywords: query.split(/\s+/).filter(Boolean),
      });
      if (!result.ok) {
        setMissingKey(Boolean(result.missingKey));
        setError(result.error);
        return;
      }
      setError(null);
      setImages(result.images);
    });
  }

  function lock() {
    const picked = Object.values(selected);
    if (picked.length === 0) {
      setError("Select at least one image to lock.");
      return;
    }
    startTransition(async () => {
      const result = await lockImagePoolAction({
        classId,
        conceptId,
        keywords: query.split(/\s+/).filter(Boolean),
        images: picked,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChanged();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Curate images — {conceptTitle}</SheetTitle>
          <SheetDescription>
            Search Unsplash, click images to include them, then lock the pool.
            Locked pools never swap mid-class.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {missingKey ? <MissingApiKeyNotice /> : null}
          <div className="space-y-2">
            <Label htmlFor="pool-keywords">Keywords</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="pool-keywords"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button type="button" onClick={search} disabled={pending || missingKey}>
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={regenerate}
                disabled={pending || missingKey}
              >
                Regenerate
              </Button>
            </div>
          </div>
          {pool?.items.length ? (
            <p className="text-xs text-ivory/50">
              Current locked pool: {pool.items.length} images
              {pool.is_locked ? " (locked)" : " (unlocked)"}.
            </p>
          ) : null}
          <UnsplashGrid
            images={images}
            selectedIds={selectedIds}
            onToggle={(image) => {
              setSelected((prev) => {
                const next = { ...prev };
                if (next[image.id]) delete next[image.id];
                else next[image.id] = image;
                return next;
              });
            }}
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="button" onClick={lock} disabled={pending || missingKey}>
            Lock pool
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
