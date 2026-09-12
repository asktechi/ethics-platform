"use client";

import { GripVertical, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MaterialListRow } from "@/lib/data/materials.types";

function typeLabel(type: string, filename: string) {
  const ext = filename.split(".").pop()?.toUpperCase();
  if (ext) return ext;
  return type.toUpperCase();
}

export function MaterialListItem({
  material,
  selected,
  sortable,
  dragHandle,
  onSelect,
  onRename,
  onReextract,
  onDownload,
  onArchive,
  onRestore,
  onVersions,
}: {
  material: MaterialListRow;
  selected: boolean;
  sortable?: boolean;
  dragHandle?: {
    attributes: object;
    listeners?: object;
  };
  onSelect: () => void;
  onRename: () => void;
  onReextract: () => void;
  onDownload: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onVersions: () => void;
}) {
  const archived = Boolean(material.deleted_at);
  return (
    <div
      className={cn(
        "flex items-start gap-2 border px-3 py-3",
        selected ? "border-gold/50 bg-card" : "border-border bg-card/50",
        archived && "opacity-70",
      )}
    >
      {sortable ? (
        <button
          type="button"
          className="mt-0.5 cursor-grab text-ivory/40"
          aria-label={`Reorder ${material.original_filename}`}
          {...dragHandle?.attributes}
          {...dragHandle?.listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-ivory">
            {material.original_filename}
          </p>
          <Badge variant="outline">
            {typeLabel(material.type, material.original_filename)}
          </Badge>
          <Badge variant="secondary">{material.versionLabel}</Badge>
          {archived ? <Badge variant="outline">Archived</Badge> : null}
          {!material.is_current ? (
            <Badge variant="outline">Not current</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-ivory/50">
          {material.slideCount} slides ·{" "}
          {new Date(material.uploaded_at).toLocaleString()}
        </p>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Material actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onReextract}>Re-extract</DropdownMenuItem>
          <DropdownMenuItem onClick={onDownload}>
            Download original
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onVersions}>Version history</DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem onClick={onRestore}>Restore</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onArchive}>Archive</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
