"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ClassFormModal } from "@/components/ClassFormModal";
import { Button } from "@/components/ui/button";

export function NewClassButton({
  levelId,
  levelSlug,
}: {
  levelId: string;
  levelSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className="bg-gold text-navy hover:bg-gold/90" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New Class
      </Button>
      <ClassFormModal
        open={open}
        onOpenChange={setOpen}
        mode="create"
        levelId={levelId}
        levelSlug={levelSlug}
      />
    </>
  );
}
