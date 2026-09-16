"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreClassAction } from "@/app/(app)/_actions/class.actions";
import { Button } from "@/components/ui/button";

export function RestoreArchivedClassButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        className="bg-gold text-navy hover:bg-gold/90"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await restoreClassAction({ id: classId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            router.refresh();
          });
        }}
      >
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
