import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/auth";
import { getGameTemplate } from "@/lib/data/games";
import { resolveGameQuestions } from "@/lib/games/resolve";

export default async function GameDiagnosePage({ params }: { params: { id: string } }) {
  let template;
  try {
    template = await getGameTemplate(params.id);
  } catch {
    redirect("/games");
  }
  const { supabase } = await requireUser();
  const resolved = await resolveGameQuestions(template, { supabase, requireApproved: true });
  const ungated = await resolveGameQuestions(template, { supabase, requireApproved: false });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/games", label: "Games" },
          { href: `/games/${template.id}`, label: template.name },
          { label: "Diagnose" },
        ]}
        title="Game diagnostics"
        description="Same resolver used by overview, the wizard, and launch."
        actions={
          <Button asChild variant="outline">
            <Link href={`/games/${template.id}/edit`}>Edit game</Link>
          </Button>
        }
      />
      <div className="mt-8 space-y-6 text-sm">
        <section className="border border-white/10 bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gold">Template</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <Row label="id" value={template.id} />
            <Row label="version" value={String(template.version)} />
            <Row label="mode" value={template.mode} />
            <Row label="class_id" value={template.class_id} />
            <Row label="pool_id" value={template.pool_id ?? "null"} />
          </dl>
        </section>
        <section className="border border-white/10 bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gold">filter_json</p>
          <pre className="mt-3 overflow-auto text-xs text-ivory/70">{JSON.stringify(template.filter_json, null, 2)}</pre>
        </section>
        <section className="border border-white/10 bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gold">resolveGameQuestions (requireApproved)</p>
          <pre className="mt-3 overflow-auto text-xs text-ivory/70">
            {JSON.stringify(
              {
                source: resolved.source,
                poolId: resolved.poolId,
                questionCount: resolved.questions.length,
                diagnostics: resolved.diagnostics,
                ungatedCount: ungated.questions.length,
              },
              null,
              2,
            )}
          </pre>
        </section>
        <section className="border border-white/10 bg-card p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gold">First 10 playable questions</p>
          {resolved.questions.length === 0 ? (
            <p className="mt-3 text-ivory/50">None. This game cannot launch.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {resolved.questions.slice(0, 10).map((question, index) => (
                <li key={question.id}>
                  {index + 1}. {question.stem}{" "}
                  <span className="text-ivory/40">
                    ({question.approved ? "approved" : "unapproved"} · {question.difficulty ?? "—"} · {question.source ?? "—"})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-ivory/40">{label}</dt>
      <dd className="break-all font-mono text-xs">{value}</dd>
    </div>
  );
}
