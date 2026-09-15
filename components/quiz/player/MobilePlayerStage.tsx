"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

export function MobilePlayerStage({
  debug = false,
  headerLeft,
  headerCenter,
  headerRight,
  headerAbove,
  headerBelow,
  question,
  questionKey,
  revealPanel,
  answers,
  floating,
  paused,
}: {
  debug?: boolean;
  headerLeft: ReactNode;
  headerCenter: ReactNode;
  headerRight: ReactNode;
  headerAbove?: ReactNode;
  headerBelow?: ReactNode;
  question: ReactNode;
  questionKey?: string | number;
  revealPanel?: ReactNode;
  answers: ReactNode;
  floating?: ReactNode;
  paused?: boolean;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [overflowHint, setOverflowHint] = useState(false);

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 12;
    if (!overflowing) {
      setOverflowHint(false);
      return;
    }
    setOverflowHint(true);
    const timer = window.setTimeout(() => setOverflowHint(false), 3000);
    return () => window.clearTimeout(timer);
  }, [questionKey, revealPanel]);

  return (
    <div
      data-player-stage="mobile"
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-navy pt-[env(safe-area-inset-top)]"
    >
      {paused ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-navy/85">
          <p className="font-display text-3xl text-gold">Paused by host</p>
        </div>
      ) : null}

      {headerAbove ? (
        <div className="shrink-0 px-4 pb-1 pt-1" data-player-zone="header-extra">
          {headerAbove}
        </div>
      ) : null}
      <header
        data-player-zone="header"
        className={cn(
          "relative z-10 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-gold/20 px-4",
          debug && "outline outline-2 outline-cyan-400",
        )}
      >
        <div className="min-w-0 text-[11px] uppercase tracking-[0.14em] text-ivory/55">{headerLeft}</div>
        <div className="flex shrink-0 items-center justify-center">{headerCenter}</div>
        <div className="min-w-0 text-right font-mono text-sm tabular-nums text-gold">{headerRight}</div>
      </header>
      {headerBelow ? (
        <div className="shrink-0 border-b border-gold/20 px-4 py-1.5">{headerBelow}</div>
      ) : null}

      <div
        ref={zoneRef}
        data-player-zone="question"
        className={cn(
          "player-question-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4",
          debug && "outline outline-2 outline-lime-400",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={questionKey ?? "q"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION}
            className="text-[clamp(17px,4.5vw,22px)] leading-[1.5] text-ivory"
          >
            {question}
          </motion.div>
        </AnimatePresence>
        {revealPanel ? (
          <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={TRANSITION}
            className="mt-4"
          >
            {revealPanel}
          </motion.div>
        ) : null}
      </div>

      <div
        data-player-zone="answers"
        className={cn(
          "relative z-10 shrink-0 px-3 pt-2",
          debug && "outline outline-2 outline-fuchsia-400",
        )}
        style={{
          paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          background: "linear-gradient(to top, #0B1B2B 85%, rgba(11,27,43,0))",
        }}
      >
        {overflowHint ? (
          <p className="pointer-events-none absolute -top-8 right-3 rounded-full bg-navy/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-ivory/70">
            scroll for more ↓
          </p>
        ) : null}
        {answers}
        {floating}
      </div>
    </div>
  );
}

export function MobileRevealPanel({
  lastDelta,
  correctKey,
  correctText,
  explanation,
  extra,
  damage,
}: {
  lastDelta: number | "missed" | null;
  correctKey: string | null;
  correctText?: string | null;
  explanation: string;
  extra?: ReactNode;
  damage?: { amount: number; kind: "damage" | "heal" | "party" } | null;
}) {
  const missed = lastDelta === "missed";
  const incorrect = lastDelta === 0 || missed;
  return (
    <div className="rounded-xl border border-white/10 bg-card/80 p-4">
      <p
        className={cn(
          "font-display text-3xl",
          incorrect ? "text-red-300" : "text-emerald-300",
        )}
      >
        {missed ? "Missed" : incorrect ? "Incorrect" : "Correct"}
      </p>
      {correctKey ? (
        <p className="mt-1 text-sm text-ivory/70">
          Answer {correctKey}
          {correctText ? ` — ${correctText}` : ""}
        </p>
      ) : null}
      {damage ? (
        <motion.p
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={TRANSITION}
          className={cn(
            "mt-2 font-display text-2xl",
            damage.kind === "damage" ? "text-emerald-300" : "text-red-300",
          )}
        >
          {damage.kind === "damage"
            ? `−${damage.amount} boss HP`
            : damage.kind === "party"
              ? `Party −${damage.amount}`
              : `Boss +${damage.amount}`}
        </motion.p>
      ) : null}
      {explanation ? (
        <div className="player-question-scroll mt-3 max-h-40 overflow-y-auto text-sm leading-6 text-ivory/80">
          {explanation}
        </div>
      ) : null}
      {extra}
    </div>
  );
}
