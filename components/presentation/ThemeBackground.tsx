"use client";

import { motion } from "framer-motion";
import { hashString } from "@/lib/presentation/contrast";
import type { ThemePalette } from "@/lib/themes/types";

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")";

function vignetteFromId(slideId: string, themeVignette?: number) {
  const hashed = hashString(slideId);
  const wobble = (hashed % 40) / 100;
  const base = themeVignette ?? 0.3;
  return Math.min(0.72, Math.max(0.22, base * 0.7 + wobble + 0.18));
}

export function ThemeBackground({
  slideId,
  theme,
  imageUrl,
}: {
  slideId: string;
  theme: ThemePalette;
  imageUrl: string | null;
}) {
  const depth = vignetteFromId(slideId, theme.vignette);
  const angle = theme.gradientAngle ?? 210;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        key={`${slideId}:${imageUrl ?? "gradient"}`}
        className="absolute inset-0"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover grayscale"
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: theme.bg, mixBlendMode: "multiply", opacity: 0.78 }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: theme.accent, mixBlendMode: "color", opacity: 0.32 }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(${angle}deg, ${theme.bg} 0%, ${theme.accent} 140%)`,
            }}
          />
        )}
      </motion.div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${Math.round((1 - depth) * 55)}%, #000 ${Math.round(100 - depth * 18)}%)`,
          opacity: 0.85,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: NOISE }}
      />
    </div>
  );
}
