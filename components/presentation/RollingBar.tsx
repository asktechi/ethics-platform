"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties, MutableRefObject } from "react";

export type RollingDepth = 0 | 1 | 2 | "older" | "upcoming";

export type RollingLine = {
  id: string;
  text: string;
  depth: RollingDepth;
  index: number;
};

const GAP = "clamp(16px, 2.5vh, 40px)";

function depthStyle(depth: RollingDepth, text: string, accent: string): CSSProperties {
  if (depth === "upcoming") {
    return {
      fontSize: "clamp(16px, 2.2vw, 26px)",
      fontWeight: 400,
      opacity: 0.12,
      filter: "blur(3px)",
      color: text,
      transform: "none",
    };
  }
  if (depth === 0) {
    return {
      fontSize: "clamp(28px, 5vw, 64px)",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      opacity: 1,
      color: text,
      transform: "perspective(800px) translateZ(0) scale(1)",
      textShadow: "0 2px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(201,162,39,0.15)",
      borderLeft: `4px solid ${accent}`,
      paddingLeft: 16,
      boxShadow: `-8px 0 24px ${accent}33`,
    };
  }
  if (depth === 1) {
    return {
      fontSize: "clamp(22px, 3.6vw, 42px)",
      fontWeight: 500,
      opacity: 0.85,
      color: text,
      transform: "translateZ(-40px) scale(0.95)",
    };
  }
  if (depth === 2) {
    return {
      fontSize: "clamp(18px, 2.8vw, 34px)",
      fontWeight: 400,
      opacity: 0.65,
      color: text,
      transform: "translateZ(-80px) scale(0.90)",
    };
  }
  return {
    fontSize: "clamp(16px, 2.2vw, 26px)",
    fontWeight: 400,
    opacity: 0.4,
    color: text,
    transform: "translateZ(-120px) scale(0.86)",
  };
}

export function RollingBar({
  lines,
  hasUpcoming,
  waiting,
  title,
  accent,
  text,
  currentLineRef,
  hostCurrentLine,
  align,
}: {
  lines: RollingLine[];
  hasUpcoming: boolean;
  waiting: boolean;
  title: string;
  accent: string;
  text: string;
  currentLineRef: MutableRefObject<HTMLDivElement | null>;
  hostCurrentLine: number;
  align: "left" | "center";
}) {
  if (waiting) {
    return (
      <div
        className="flex min-h-full flex-col items-center justify-center px-6 text-center"
        data-rolling-empty="true"
      >
        {title ? (
          <h1 className="slide-headline max-w-[18ch]" style={{ color: text }}>
            {title}
          </h1>
        ) : null}
        <p
          className="mt-8 flex items-center gap-2 text-[13px] uppercase tracking-[0.22em]"
          style={{ color: `${text}99` }}
          data-waiting-host="true"
        >
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          Waiting for the host…
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-[1200px] min-[1920px]:max-w-[1400px]"
      data-rolling-bar="true"
      style={{ perspective: 800, textAlign: align }}
    >
      <div className="flex flex-col" style={{ gap: GAP, transformStyle: "preserve-3d" }}>
        <AnimatePresence initial={false}>
          {lines.map((line) => {
            const isCurrent = line.depth === 0;
            const style = depthStyle(line.depth, text, accent);
            return (
              <motion.div
                layout
                key={line.id}
                ref={(node) => {
                  if (isCurrent) currentLineRef.current = node;
                }}
                data-reveal-line={line.index}
                data-rolling-depth={String(line.depth)}
                data-host-current={hostCurrentLine === line.index ? "true" : "false"}
                initial={isCurrent ? { opacity: 0, y: 28 } : { opacity: 0 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.5,
                    ease: "easeOut",
                    delay: isCurrent ? 0.1 : 0,
                  },
                }}
                exit={{ opacity: 0, y: -12, transition: { duration: 0.3, ease: "easeOut" } }}
                className="relative"
              >
                <p
                  className="relative m-0"
                  style={{
                    ...style,
                    transition:
                      "font-size 500ms ease-out, opacity 500ms ease-out, transform 500ms ease-out, filter 500ms ease-out",
                  }}
                >
                  {line.text}
                  {isCurrent ? (
                    <span
                      data-live-attribution="true"
                      className="pointer-events-none ml-3 align-middle text-[12px] font-medium"
                      style={{ color: accent }}
                    >
                      ● live
                    </span>
                  ) : null}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {hasUpcoming ? (
          <p
            data-rolling-upcoming="true"
            className="m-0 inline-flex select-none items-center rounded-full px-4 py-1"
            style={{
              ...depthStyle("upcoming", text, accent),
              backgroundColor: `${text}14`,
            }}
            aria-hidden
          >
            …
          </p>
        ) : null}
        <div data-rolling-sentinel="true" className="h-[38vh] w-full shrink-0" aria-hidden />
      </div>
    </div>
  );
}

export function JumpToLivePill({
  visible,
  onJump,
}: {
  visible: boolean;
  onJump: () => void;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          data-jump-to-live="true"
          data-scroll-hint="true"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          onClick={onJump}
          className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-navy shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
        >
          ● Live — tap to catch up
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
