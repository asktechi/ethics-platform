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
