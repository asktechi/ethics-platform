import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy text-ivory">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Button asChild variant="outline" className="border-gold/50 text-ivory">
          <Link href="/login">Instructor sign in</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            CFA Institute ethics
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-ivory md:text-5xl">
            One idea per screen.
            <br />
            Standards taught in sequence.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ivory/72">
            A personal teaching platform for CFA ethics instruction across
            Levels I–III. You author the class. Students join a live quiz with
            an open link and a display name. Original materials are preserved
            forever.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-gold text-navy hover:bg-gold/90">
              <Link href="/dashboard">Open instructor desk</Link>
            </Button>
            <Button asChild variant="outline" className="border-ivory/20 text-ivory">
              <Link href="/login">Send a magic link</Link>
            </Button>
          </div>
        </div>

        <aside className="border border-border bg-card p-6">
          <h2 className="font-display text-xl text-ivory">Curriculum model</h2>
          <ol className="mt-5 space-y-3 text-sm text-ivory/75">
            <li className="border-l-2 border-gold pl-3">Introduction</li>
            <li className="border-l-2 border-gold pl-3">Concepts</li>
            <li className="border-l-2 border-gold pl-3">
              Standards I–VII — Code and Standards
            </li>
          </ol>
          <p className="mt-6 text-xs leading-5 text-ivory/50">
            Phase 0 shell only. Schema, auth, and seed data begin in Phase 1.
          </p>
        </aside>
      </main>
    </div>
  );
}
