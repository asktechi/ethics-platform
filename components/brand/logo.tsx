import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

export function Logo({ href = "/", compact = false, className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-3 text-ivory", className)}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-gold/70 bg-navy text-[0.7rem] font-semibold tracking-[0.14em] text-gold"
      >
        EP
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.05rem] tracking-[0.08em] text-ivory">
            Ethics Platform
          </span>
          <span className="mt-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ivory/55">
            CFA Institute instruction
          </span>
        </span>
      ) : null}
    </Link>
  );
}
