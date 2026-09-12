import Link from "next/link";
import { ArrowUpRight, BookOpen, GraduationCap, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brandTokens } from "@/lib/theme/tokens";

const swatches = [
  { name: "navy", hex: brandTokens.navy },
  { name: "cfaBlue", hex: brandTokens.cfaBlue },
  { name: "gold", hex: brandTokens.gold },
  { name: "ivory", hex: brandTokens.ivory },
  { name: "charcoal", hex: brandTokens.charcoal },
] as const;

const levels = [
  {
    code: "I",
    title: "Level I",
    summary: "Ethical and Professional Standards — foundations of the Code and Standards.",
    icon: GraduationCap,
    status: "Ready to seed",
  },
  {
    code: "II",
    title: "Level II",
    summary: "Application of the Standards to research, issuer relations, and conflicts.",
    icon: Layers3,
    status: "Ready to seed",
  },
  {
    code: "III",
    title: "Level III",
    summary: "Duties to clients, portfolio construction, and professional conduct in practice.",
    icon: BookOpen,
    status: "Ready to seed",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Instructor desk
          </p>
          <h1 className="mt-2 font-display text-3xl text-ivory md:text-4xl">
            Your Levels
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ivory/70">
            CFA ethics curriculum for Levels I–III. Classes, sections, and
            standards are seeded in Phase 1. Nothing AI-generated goes live
            without your approval.
          </p>
        </div>
        <Button asChild variant="outline" className="border-gold/40 text-ivory">
          <Link href="/login">Instructor sign-in stub</Link>
        </Button>
      </div>

      <section aria-label="Brand palette" className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Brand palette
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {swatches.map((swatch) => (
            <div key={swatch.name} className="flex min-w-[6.5rem] flex-col gap-2">
              <div
                className="h-14 w-full border border-ivory/20"
                style={{ backgroundColor: swatch.hex }}
                title={`${swatch.name} ${swatch.hex}`}
              />
              <p className="text-xs font-medium text-ivory">{swatch.name}</p>
              <p className="font-mono text-[0.7rem] uppercase text-ivory/55">
                {swatch.hex}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {levels.map((level) => {
          const Icon = level.icon;
          return (
            <article
              key={level.code}
              className="flex flex-col border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center border border-gold/40 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge
                  variant="outline"
                  className="border-gold/30 font-normal text-ivory/70"
                >
                  {level.status}
                </Badge>
              </div>
              <h2 className="mt-5 font-display text-2xl text-ivory">
                {level.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-ivory/65">
                {level.summary}
              </p>
              <Link
                href="/dashboard"
                className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80"
              >
                Open level
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="mt-10 border border-dashed border-border bg-card/40 px-5 py-8">
        <h2 className="font-display text-xl text-ivory">Recent classes</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ivory/60">
          No live classes yet. After Phase 2, recently taught sessions will
          appear here with their locked theme and last-used slide.
        </p>
      </section>
    </div>
  );
}
