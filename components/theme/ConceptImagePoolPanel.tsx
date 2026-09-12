"use client";

import { useMemo, useState, useTransition } from "react";
import { clearPoolAction } from "@/app/(app)/_actions/theme.actions";
import { ImagePoolDrawer } from "@/components/theme/ImagePoolDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImagePoolWithItems } from "@/lib/data/image-pools.types";
import type { Concept } from "@/types/db.helpers";

function statusOf(pool: ImagePoolWithItems | undefined) {
  if (!pool || pool.items.length === 0) return "none";
  return pool.is_locked ? "locked" : "unlocked";
}

export function ConceptImagePoolPanel({
  classId,
  concepts,
  pools,
  unsplashConfigured,
  onChanged,
}: {
  classId: string;
  concepts: Concept[];
  pools: ImagePoolWithItems[];
  unsplashConfigured: boolean;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const byConcept = useMemo(
    () => new Map(pools.map((pool) => [pool.concept_id, pool])),
    [pools],
  );
  const selected = concepts.find((concept) => concept.id === openId) ?? null;

  return (
    <div className="space-y-3">
      {concepts.length === 0 ? (
        <p className="text-sm text-ivory/55">
          Add concepts on the Sections tab before curating image pools.
        </p>
      ) : (
        <ul className="space-y-2">
          {concepts.map((concept) => {
            const pool = byConcept.get(concept.id);
            const status = statusOf(pool);
            return (
              <li
                key={concept.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card/60 px-3 py-3"
              >
                <div>
                  <p className="text-sm text-ivory">{concept.title}</p>
                  <div className="mt-1">
                    <Badge variant={status === "locked" ? "default" : "outline"}>
                      {status === "locked"
                        ? "Locked pool"
                        : status === "unlocked"
                          ? "Unlocked pool"
                          : "No pool"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => setOpenId(concept.id)}>
                    Curate images
                  </Button>
                  {pool ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        startTransition(async () => {
                          await clearPoolAction({ classId, poolId: pool.id });
                          onChanged();
                        })
                      }
                    >
                      Clear pool
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {selected ? (
        <ImagePoolDrawer
          classId={classId}
          conceptId={selected.id}
          conceptTitle={selected.title}
          pool={byConcept.get(selected.id) ?? null}
          unsplashConfigured={unsplashConfigured}
          open={Boolean(openId)}
          onOpenChange={(open) => {
            if (!open) setOpenId(null);
          }}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}
