"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DuplicateFileModal({
  open,
  filename,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  filename: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Already uploaded</DialogTitle>
          <DialogDescription>
            {filename} already exists in this class. Upload as a new version?
            The original file stays immutable — we will add a new materials
            row and mark the prior version as not current.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Yes, new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
