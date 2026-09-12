"use client";

import { useState } from "react";
import { createClassAction, updateClassAction } from "@/app/(app)/_actions/class.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Defaults = {
  title: string;
  audience: string;
  description: string;
};

export function ClassFormModal({
  open,
  onOpenChange,
  mode,
  levelId,
  levelSlug,
  classId,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  levelId: string;
  levelSlug: string;
  classId?: string;
  defaults?: Defaults;
}) {
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [audience, setAudience] = useState(defaults?.audience ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result =
      mode === "create"
        ? await createClassAction({
            levelId,
            levelSlug,
            title,
            audience,
            description,
          })
        : await updateClassAction({
            id: classId,
            title,
            audience,
            description,
          });

    setPending(false);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-ivory">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "create" ? "New class" : "Edit class"}
          </DialogTitle>
          <DialogDescription className="text-ivory/60">
            Classes belong to a single CFA level. Originals stay immutable later;
            this record is the teaching container.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="class-title">Title</Label>
            <Input
              id="class-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="border-border bg-navy text-ivory"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-audience">Audience</Label>
            <Input
              id="class-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="Level I candidates"
              className="border-border bg-navy text-ivory"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-description">Description</Label>
            <Textarea
              id="class-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="border-border bg-navy text-ivory"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-ivory/20 text-ivory"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-gold text-navy hover:bg-gold/90">
              {pending ? "Saving…" : mode === "create" ? "Create class" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
