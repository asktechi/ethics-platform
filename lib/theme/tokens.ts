export const brandTokens = {
  navy: "#0B1B2B",
  cfaBlue: "#003A70",
  gold: "#C9A227",
  ivory: "#F5F1E8",
  charcoal: "#1C1C1C",
} as const;

export type BrandTokenName = keyof typeof brandTokens;

export const brandHsl = {
  navy: "210 59% 11%",
  cfaBlue: "209 100% 22%",
  gold: "46 68% 47%",
  ivory: "41 39% 94%",
  charcoal: "0 0% 11%",
} as const;
