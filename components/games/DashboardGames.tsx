import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { GameCard } from "@/components/games/GameCard";
import { listGameTemplates, listRecentEndedInstances, listUpcomingInstances } from "@/lib/data/games";

export async function DashboardGames() {
  const [templates, upcoming, recent] = await Promise.all([
    listGameTemplates(),
    listUpcomingInstances(),
    listRecentEndedInstances(5),
  ]);
  const cards = templates.slice(0, 6);

  return (
    <div className="mt-10 space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Your Games</h2>
          <Link href="/games" className="text-sm text-gold underline">
            Open library
          </Link>
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-ivory/50">
            <Link href="/games/new" className="text-gold underline">
              Build your first game
            </Link>
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cards.map((row) => (
              <GameCard
                key={row.id}
                id={row.id}
                name={row.name}
                description={row.description}
                tags={row.tags}
                mode={row.mode}
                poolCount={row.pool_count}
                playCount={row.play_count}
                lastPlayedAt={row.last_played_at}
                compact
              />
            ))}
          </div>
        )}
      </section>

      {upcoming[0] ? (
        <section className="border border-gold/40 bg-gold/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-gold">Next scheduled</p>
          <h3 className="mt-2 font-display text-2xl">{upcoming[0].template_name}</h3>
          <p className="mt-1 text-sm text-ivory/70">
            {upcoming[0].scheduled_for
              ? formatDistanceToNow(new Date(upcoming[0].scheduled_for), { addSuffix: true })
              : ""}{" "}
            · code {upcoming[0].join_code}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-2xl">Recent sessions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {recent.map((row) => (
            <li key={row.id}>
              <Link href={`/sessions/${row.id}`} className="hover:text-gold">
                {row.template_name} · {row.participant_count} players · avg {row.avg_score ?? "—"}
              </Link>
            </li>
          ))}
          {recent.length === 0 ? <li className="text-ivory/45">No ended sessions yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
