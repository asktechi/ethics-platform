"use client";

import { motion } from "framer-motion";

export function RevealLines({
  lines,
  lineIndex,
  instant,
  flushed,
  className,
}: {
  lines: string[];
  lineIndex: number;
  instant?: boolean;
  flushed?: boolean;
  className?: string;
}) {
  if (lines.length === 0) return null;
  const visibleThrough = instant ? lines.length - 1 : lineIndex;
  const skipMotion = Boolean(instant || flushed);

  return (
    <div className={className} data-reveal-lines={lines.length} data-reveal-index={visibleThrough}>
      {lines.map((line, index) => {
        const visible = index <= visibleThrough;
        const recent = index >= visibleThrough - 2;
        return (
          <motion.p
            key={`${index}:${line}`}
            data-reveal-line={index}
            data-reveal-visible={visible ? "true" : "false"}
            initial={false}
            animate={{
              opacity: visible ? (recent ? 1 : 0.7) : 0,
              y: visible ? 0 : 8,
              height: visible ? "auto" : 0,
              marginBottom: visible ? 12 : 0,
            }}
            transition={{
              duration: skipMotion ? 0 : 0.4,
              ease: "easeOut",
              delay: skipMotion ? 0 : Math.max(0, index - Math.max(0, visibleThrough - 1)) * 0.08,
            }}
            className="overflow-hidden leading-8"
          >
            {line}
          </motion.p>
        );
      })}
    </div>
  );
}
