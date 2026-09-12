import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-dashed border-border bg-card/40 px-5 py-8",
        className,
      )}
    >
      <h2 className="font-display text-xl text-ivory">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-xl text-sm leading-6 text-ivory/60">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
