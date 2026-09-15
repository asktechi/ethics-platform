"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  adjustHex,
  deepenUntilContrast,
  hashString,
  mixHex,
} from "@/lib/presentation/contrast";
import type { ThemePalette } from "@/lib/themes/types";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23g)' opacity='0.55'/></svg>\")";

function layerParams(slideId: string, theme: ThemePalette) {
  const hash = hashString(slideId);
  const angle = (hash % 160) + 16;
  const glowX = 28 + (hash % 45);
  const glowY = 18 + ((hash >> 5) % 36);
  const glow2X = 72 + ((hash >> 3) % 18);
  const glow2Y = 68 + ((hash >> 7) % 22);
  const baseVignette = 0.28 + ((hash >> 9) % 28) / 100;
  const themeVignette = theme.vignette ?? 0.3;
  const far = adjustHex(theme.bg, -0.42);
  const darker = adjustHex(theme.bg, -0.28);
  const lighter = adjustHex(theme.bg, 0.16);
  const mid = mixHex(theme.bg, theme.accent, 0.22);
  const wash = mixHex(theme.bg, theme.accent, 0.14);
  const text = theme.text ?? "#F5F1E8";
  const vignette = deepenUntilContrast(text, mid, Math.max(baseVignette, themeVignette * 0.7));
  return { angle, glowX, glowY, glow2X, glow2Y, far, darker, lighter, wash, vignette };
}

/**
 * Stage backdrop. An optional image is full-bleed duotone. With no image,
 * the theme gradient is the designed visual — not a placeholder.
 */
export function ThemeBackground({
  slideId,
  theme,
  imageUrl,
  attribution = null,
}: {
  slideId: string;
  theme: ThemePalette;
  imageUrl: string | null;
  attribution?: string | null;
}) {
  const { angle, glowX, glowY, glow2X, glow2Y, far, darker, lighter, wash, vignette } =
    layerParams(slideId, theme);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden
      data-theme-layers="5"
      data-has-image={showImage ? "true" : "false"}
      data-gradient-quality="cinematic"
      data-image-attribution={attribution ?? ""}
    >
      {/* Layer 1 — Multi-stop cinematic gradient from theme.bg */}
      <div
        data-bg-layer="base"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${angle}deg, ${far} 0%, ${darker} 22%, ${theme.bg} 48%, ${wash} 74%, ${lighter} 100%)`,
        }}
      />

      {/* Layer 2 — Accent glow + secondary wash */}
      <div
        data-bg-layer="glow"
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 80% 55% at ${glowX}% ${glowY}%, ${theme.accent} 0%, transparent 62%)`,
            `radial-gradient(ellipse 55% 40% at ${glow2X}% ${glow2Y}%, ${theme.accent} 0%, transparent 70%)`,
          ].join(", "),
          opacity: showImage ? 0.18 : 0.28,
        }}
      />

      {/* Layer 3 — Duotone image (skipped when imageUrl is null) */}
      {showImage ? (
        <motion.div
          key={`${slideId}:${imageUrl}`}
          data-bg-layer="image"
          className="absolute inset-0"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl ?? ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover grayscale"
            onError={() => setFailed(true)}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: theme.bg, mixBlendMode: "multiply", opacity: 0.72 }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: theme.accent, mixBlendMode: "soft-light", opacity: 0.45 }}
          />
        </motion.div>
      ) : (
        <div data-bg-layer="image" className="hidden" />
      )}

      {/* Layer 4 — SVG grain at 3% */}
      <div
        data-bg-layer="grain"
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, opacity: 0.03 }}
      />

      {/* Layer 5 — Edge vignette (contrast-guarded) */}
      <div
        data-bg-layer="vignette"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 42% 32%, transparent ${Math.round((1 - vignette) * 48)}%, #000 ${Math.round(88 + vignette * 10)}%)`,
          opacity: 0.88,
        }}
      />
    </div>
  );
}
