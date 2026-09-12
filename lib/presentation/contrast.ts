function parseHex(color: string): [number, number, number] | null {
  const raw = color.trim().replace("#", "");
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0] + raw[0], 16);
    const g = Number.parseInt(raw[1] + raw[1], 16);
    const b = Number.parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  if (raw.length === 6) {
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  return null;
}

function channel(value: number) {
  const next = value / 255;
  return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrastRatio(foreground: string, background: string) {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return 21;
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Force WCAG AA (4.5:1) text against the theme background. */
export function ensureAaText(foreground: string, background: string) {
  if (contrastRatio(foreground, background) >= 4.5) return foreground;
  const bg = parseHex(background);
  const bgLum = bg ? luminance(bg) : 0;
  return bgLum > 0.45 ? "#1C1C1C" : "#F5F1E8";
}

export function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** amount < 0 darkens, > 0 lightens. */
export function adjustHex(color: string, amount: number) {
  const rgb = parseHex(color) ?? [11, 27, 43];
  const next = rgb.map((channel) => {
    if (amount < 0) return channel * (1 + amount);
    return channel + (255 - channel) * amount;
  }) as [number, number, number];
  return toHex(next);
}

export function mixHex(left: string, right: string, amount: number) {
  const a = parseHex(left) ?? [11, 27, 43];
  const b = parseHex(right) ?? [0, 0, 0];
  const t = Math.max(0, Math.min(1, amount));
  return toHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
}

/**
 * Deepen a vignette mix against black until theme text hits WCAG AA.
 * Always returns a usable depth — never throws.
 */
export function deepenUntilContrast(text: string, background: string, startVignette: number) {
  let depth = Math.max(0.18, Math.min(0.92, startVignette));
  let effective = mixHex(background, "#000000", depth);
  let steps = 0;
  while (contrastRatio(text, effective) < 4.5 && depth < 0.92 && steps < 24) {
    depth = Math.min(0.92, depth + 0.04);
    effective = mixHex(background, "#000000", depth);
    steps += 1;
  }
  if (contrastRatio(text, effective) < 4.5) {
    depth = 0.92;
    console.warn(
      `[presentation] contrast guard deepened vignette to ${depth} for ${background} / ${text}`,
    );
  }
  return depth;
}
