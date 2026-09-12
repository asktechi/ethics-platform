import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Level } from "@/types/db.helpers";

export function LevelCard({
  level,
  classCount,
  description,
}: {
  level: Level;
  classCount: number;
  description: string;
}) {
  return (
    <article className="flex flex-col border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          CFA Ethics
        </p>
        <Badge variant="outline" className="border-gold/30 font-normal text-ivory/70">
          {classCount} {classCount === 1 ? "class" : "classes"}
        </Badge>
      </div>
      <h2 className="mt-5 font-display text-2xl text-ivory">{level.name}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-ivory/65">{description}</p>
      <Button asChild className="mt-5 bg-gold text-navy hover:bg-gold/90">
        <Link href={`/level/${level.slug}`}>
          Open
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  );
}
