"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical } from "lucide-react";
import {
  archiveClassAction,
  duplicateClassAction,
  restoreClassAction,
} from "@/app/(app)/_actions/class.actions";
import { ClassFormModal } from "@/components/ClassFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Class } from "@/types/db.helpers";

export function ClassCard({
  item,
  levelId,
  levelSlug,
}: {
  item: Class;
  levelId: string;
  levelSlug: string;
}) {
  const archived = Boolean(item.deleted_at);
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <article
      className={cn(
        "flex flex-col border border-border bg-card p-5",
        archived && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {archived ? (
            <Badge variant="outline" className="mb-2 border-ivory/20 text-ivory/60">
              Archived
            </Badge>
          ) : null}
          <Link
            href={`/class/${item.id}`}
            className="font-display text-xl text-ivory hover:text-gold"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-sm text-ivory/60">
            {item.audience || "No audience set"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-ivory" aria-label="Class actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const result = await duplicateClassAction();
                setMessage(result.error);
              }}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {archived ? (
              <DropdownMenuItem
                onClick={() => void restoreClassAction({ id: item.id })}
              >
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => void archiveClassAction({ id: item.id })}
              >
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {item.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-ivory/65">
          {item.description}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-ivory/45">
        Updated {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
      </p>
      {message ? <p className="mt-2 text-xs text-gold">{message}</p> : null}
      <ClassFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        levelId={levelId}
        levelSlug={levelSlug}
        classId={item.id}
        defaults={{
          title: item.title,
          audience: item.audience ?? "",
          description: item.description ?? "",
        }}
      />
    </article>
  );
}
