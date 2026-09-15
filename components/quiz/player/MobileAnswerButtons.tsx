"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MobileChoice = { key: string; text: string };

const TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

export function MobileAnswerButtons({
  choices,
  phase,
  choice,
  correctKey,
  onLock,
  disabled,
}: {
  choices: MobileChoice[];
  phase: string;
  choice: string | null;
  correctKey: string | null;
  onLock: (key: string) => void;
  disabled?: boolean;
}) {
  const compact = phase === "reveal";
  return (
    <div className="flex flex-col gap-2">
      {choices.map((item) => {
        const selected = choice === item.key;
        const isCorrect = (correctKey ?? "").toUpperCase() === item.key.toUpperCase();
        const isWrong = compact && selected && !isCorrect;
        const faded = Boolean(choice) && !selected && phase !== "reveal";
        return (
          <motion.button
            layout
            key={item.key}
            type="button"
            disabled={disabled || phase !== "question"}
            onClick={() => onLock(item.key)}
            transition={TRANSITION}
            className={cn(
              "w-full touch-manipulation rounded-xl border text-left font-medium",
              compact
                ? "min-h-9 px-3 py-1.5 text-sm"
                : "min-h-14 px-4 py-3 text-[15px] leading-snug",
              phase === "question" && !selected && "border-ivory/20 bg-card/80",
              selected && phase !== "reveal" && "border-gold bg-gold text-navy",
              faded && "opacity-30",
              compact && isCorrect && "border-emerald-400 bg-emerald-900/40 text-ivory",
              compact && isWrong && "border-red-400 bg-red-900/40 text-ivory",
              compact && !isCorrect && !isWrong && "border-white/10 bg-white/5 text-ivory/55",
            )}
          >
            <span className="flex items-start gap-3">
              <span className={cn("shrink-0 font-semibold", selected && phase !== "reveal" ? "text-navy" : "text-gold")}>
                {item.key})
              </span>
              <span className={cn("min-w-0 flex-1", compact ? "line-clamp-1" : "line-clamp-2")}>{item.text}</span>
              {compact && isCorrect ? <span className="shrink-0 text-emerald-300">✓</span> : null}
              {compact && isWrong ? <span className="shrink-0 text-red-300">✗</span> : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
