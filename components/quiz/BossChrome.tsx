"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HostEndNavBar, PlayerEndNavBar } from "@/components/quiz/EndNavBar";
import type { BossCombatView, CombatLogEntry } from "@/lib/games/boss-view";
import { cn } from "@/lib/utils";

export function hpBarColor(ratio: number, hpBar?: string) {
  if (ratio > 0.66) return "#22C55E";
  if (ratio >= 0.33) return "#F59E0B";
  return hpBar || "#DC2626";
}

export function formatCombatLine(entry: CombatLogEntry) {
  if (entry.kind === "heal") return `${entry.name}'s wrong answer healed the boss for ${entry.amount}`;
  if (entry.kind === "party_damage") return `${entry.name}'s miss wounded the party for ${entry.amount}`;
  if ((entry.multiplier ?? 1) > 1) {
    return `STREAK x${entry.multiplier}! ${entry.name} dealt ${entry.amount} damage`;
  }
  return `${entry.name} dealt ${entry.amount} damage`;
}

export function BossPortrait({
  emoji,
  url,
  name,
  size = "md",
}: {
  emoji?: string | null;
  url?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? "h-28 w-28 text-6xl" : size === "sm" ? "h-12 w-12 text-2xl" : "h-20 w-20 text-4xl";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className={cn(px, "object-cover")} />
    );
  }
  return (
    <div className={cn(px, "flex items-center justify-center bg-black/30")} aria-hidden>
      {emoji || "♛"}
    </div>
  );
}

export function HpBar({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-ivory/55">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ivory">
          {Math.max(0, Math.round(current))} / {max}
        </span>
      </div>
      <div className="h-3 overflow-hidden bg-white/10">
        <motion.div
          className="h-full"
          animate={{ width: `${ratio * 100}%`, backgroundColor: color }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function PhaseOverlay({
  open,
  phase,
  taunt,
  accent,
  emoji,
  url,
  name,
}: {
  open: boolean;
  phase: number;
  taunt: string;
  accent: string;
  emoji?: string | null;
  url?: string | null;
  name: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 text-center"
          style={{ background: `${accent}CC` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.86, y: 16 }}
            animate={{ scale: [1, 1.04, 1], x: [0, -8, 8, -4, 4, 0], y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-ivory/70">Phase {phase}</p>
            <div className="mt-4 flex justify-center">
              <BossPortrait emoji={emoji} url={url} name={name} size="lg" />
            </div>
            <p className="mt-6 font-display text-3xl leading-snug text-ivory sm:text-5xl">{taunt}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function BossOutcomeScreen({
  combat,
  players,
  responses,
  sessionId,
  templateId,
  instanceId,
  role,
  allowReplay = false,
  joinCode,
  embedded = false,
}: {
  combat: BossCombatView;
  players: Array<{ id: string; display_name: string; score: number }>;
  responses: Array<{ ms_taken: number | null }>;
  sessionId: string;
  templateId?: string | null;
  instanceId?: string | null;
  role: "host" | "player";
  allowReplay?: boolean;
  joinCode?: string | null;
  embedded?: boolean;
}) {
  const boss = combat.boss;
  const accent = boss?.palette_json.accent ?? "#E63946";
  const victory = combat.outcome === "victory";
  const podium = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
  const answered = responses.length;
  const avgMs = answered
    ? Math.round(responses.reduce((sum, row) => sum + (row.ms_taken ?? 0), 0) / answered)
    : 0;
  const totalDamage = players.reduce((sum, player) => sum + player.score, 0);

  return (
    <div
      className={cn(
        "z-40 overflow-auto px-4 py-10 text-ivory",
        embedded ? "absolute inset-0" : "fixed inset-0",
      )}
      style={{
        background: victory
          ? `radial-gradient(circle at 50% 20%, ${accent}55, #0B1320 70%)`
          : "radial-gradient(circle at 50% 80%, #000000cc, #0B1320 72%)",
      }}
    >
      <div className="mx-auto max-w-xl text-center">
        <motion.div
          initial={victory ? { scale: 1, opacity: 1 } : { scale: 1 }}
          animate={
            victory
              ? { scale: [1, 1.12, 0.2], opacity: [1, 1, 0.15], rotate: [0, -8, 12] }
              : { scale: [1, 1.18], filter: ["brightness(1)", "brightness(0.55)"] }
          }
          transition={{ duration: 1.1 }}
          className="flex justify-center"
        >
          <BossPortrait
            emoji={boss?.portrait_emoji}
            url={boss?.portrait_url}
            name={boss?.name ?? "Boss"}
            size="lg"
          />
        </motion.div>
        {victory ? (
          <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center gap-2">
            {["#C9A227", "#E63946", "#2A9D8F", "#A78BFA"].map((color, index) => (
              <motion.span
                key={color}
                className="h-2 w-2 rounded-full"
                style={{ background: color }}
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: [0, 80 + index * 12], opacity: [1, 0] }}
                transition={{ duration: 1.4, delay: index * 0.08 }}
              />
            ))}
          </div>
        ) : null}
        <p className="mt-6 text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
          {victory ? "Victory" : "Defeat"}
        </p>
        <h1 className="mt-3 font-display text-4xl" style={{ color: accent }}>
          {victory ? boss?.victory_line : boss?.defeat_line}
        </h1>
        {!victory ? (
          <p className="mt-3 text-ivory/70">Boss remained at {combat.boss_hp} HP</p>
        ) : null}
        {victory ? (
          <ol className="mt-8 space-y-2 text-left">
            {podium.map((player, index) => (
              <li key={player.id} className="flex items-center justify-between border border-white/10 px-3 py-2">
                <span>
                  {index + 1}. {player.display_name}
                </span>
                <span className="tabular-nums text-gold">{player.score} dmg</span>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="mt-6 text-sm text-ivory/60" data-session-id={sessionId}>
          {totalDamage} total damage · {answered} answers · avg {(avgMs / 1000).toFixed(1)}s
        </p>
      </div>
      {role === "host" ? (
        <HostEndNavBar templateId={templateId} instanceId={instanceId} />
      ) : (
        <PlayerEndNavBar joinCode={joinCode} allowReplay={allowReplay} />
      )}
    </div>
  );
}

export function CombatLog({ entries }: { entries: CombatLogEntry[] }) {
  const recent = [...entries].slice(-12).reverse();
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ivory/45">Combat log</p>
      {recent.length === 0 ? <p className="text-xs text-ivory/40">No blows yet.</p> : null}
      <ul className="space-y-1 text-xs text-ivory/75">
        {recent.map((entry, index) => (
          <li key={`${entry.question_id}-${index}-${entry.name}`}>{formatCombatLine(entry)}</li>
        ))}
      </ul>
    </div>
  );
}
