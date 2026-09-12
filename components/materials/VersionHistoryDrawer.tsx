"use client";

import { useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setCurrentVersionAction } from "@/app/(app)/_actions/material.actions";
import type { Material } from "@/types/db.helpers";

function versionLabel(row: Material, all: Material[]): string {
  const byId = new Map(all.map((item) => [item.id, item]));
  let depth = 1;
  let current: Material | undefined = row;
  const seen = new Set<string>();
  while (current?.version_of && byId.has(current.version_of) && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.version_of);
  }
  return `v${depth}`;
}

export function VersionHistoryDrawer({
  classId,
  open,
  onOpenChange,
  versions,
  onChanged,
}: {
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Material[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Restore sets is_current on a version. Nothing is deleted — originals
            stay on disk.
          </SheetDescription>
        </SheetHeader>
        <ul className="mt-6 space-y-3">
          {versions.length === 0 ? (
            <li className="text-sm text-ivory/55">No versions yet.</li>
          ) : null}
          {versions.map((version) => (
            <li
              key={version.id}
              className="border border-border bg-card/60 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-ivory">
                  {versionLabel(version, versions)} · {version.original_filename}
                </p>
                {version.is_current ? (
                  <Badge className="bg-gold text-navy">Current</Badge>
                ) : null}
              </div>
              <p className="mt-1 font-mono text-[11px] text-ivory/50">
                {version.sha256.slice(0, 12)} ·{" "}
                {new Date(version.created_at).toLocaleString()}
              </p>
              {!version.is_current ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setCurrentVersionAction({
                        id: version.id,
                        classId,
                      });
                      onChanged();
                    })
                  }
                >
                  Set current
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
