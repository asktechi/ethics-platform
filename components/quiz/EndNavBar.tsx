"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const brandNavClass =
  "brand-nav inline-flex items-center justify-center border border-gold/40 bg-navy px-4 py-2.5 text-sm font-medium text-gold no-underline transition-colors hover:border-gold hover:bg-navy/80 hover:text-gold visited:text-gold";

export function BrandNavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(brandNavClass, className)}>
      {children}
    </Link>
  );
}

export function HostEndNavBar({
  templateId,
  instanceId,
}: {
  templateId?: string | null;
  instanceId?: string | null;
}) {
  return (
    <nav
      aria-label="Session end"
      className="sticky bottom-0 z-20 flex flex-wrap gap-2 border-t border-gold/30 bg-navy px-4 py-3"
    >
      <BrandNavLink href={templateId ? `/games/${templateId}` : "/games"}>← Back to Games</BrandNavLink>
      {instanceId ? <BrandNavLink href={`/sessions/${instanceId}`}>View Session Detail</BrandNavLink> : null}
      <BrandNavLink href="/dashboard">Dashboard</BrandNavLink>
    </nav>
  );
}

export function PlayerEndNavBar({
  joinCode,
  allowReplay = false,
}: {
  joinCode?: string | null;
  allowReplay?: boolean;
}) {
  return (
    <nav
      aria-label="Player end"
      className="sticky bottom-0 z-20 flex flex-wrap justify-center gap-2 border-t border-gold/30 bg-navy px-4 py-3"
    >
      {allowReplay && joinCode ? <BrandNavLink href={`/quiz/join/${joinCode}`}>Play Again</BrandNavLink> : null}
      <BrandNavLink href="/quiz/join">Back to Home</BrandNavLink>
    </nav>
  );
}

export function HostCloseToGames({ className }: { className?: string }) {
  return (
    <Link
      href="/games"
      aria-label="Close and go to games"
      className={cn(
        "brand-nav inline-flex h-9 w-9 items-center justify-center border border-gold/40 bg-navy text-gold no-underline hover:border-gold hover:bg-navy/80 visited:text-gold",
        className,
      )}
    >
      <X className="h-4 w-4" />
    </Link>
  );
}

export function CaseStudyHostEndLinks({ templateId }: { templateId?: string | null }) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <BrandNavLink href={templateId ? `/games/${templateId}` : "/games"}>Back to Games</BrandNavLink>
      <BrandNavLink href="/dashboard">Dashboard</BrandNavLink>
    </div>
  );
}
