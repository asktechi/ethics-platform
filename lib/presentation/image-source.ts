export type ImagePreference = "auto" | "pool" | "ai" | "none";

export type StageImageSource = "ai" | "pool" | "none";

export type ImageSourceLabel = "none" | "stock" | "ai";

/**
 * Stage backdrop is opt-in. Default (none / auto / missing) is the theme
 * gradient. Pool/stock and AI never fill in automatically.
 */
export function pickStageImage(input: {
  preference?: ImagePreference | null;
  generatedUrl?: string | null;
  assignmentUrl?: string | null;
  poolUrl?: string | null;
  stockUrl?: string | null;
}): { url: string | null; source: StageImageSource } {
  const preference = normalizePreference(input.preference);

  if (preference === "none") return { url: null, source: "none" };

  const generated = trimUrl(input.generatedUrl);
  const stock = trimUrl(input.stockUrl);
  const assignment = trimUrl(input.assignmentUrl);
  const pool = trimUrl(input.poolUrl);
  const curated = stock || assignment || pool;

  if (preference === "ai") {
    return { url: generated, source: generated ? "ai" : "none" };
  }
  if (preference === "pool") {
    return { url: curated, source: curated ? "pool" : "none" };
  }
  return { url: null, source: "none" };
}

export function normalizePreference(preference?: ImagePreference | null): ImagePreference {
  if (preference === "pool" || preference === "ai" || preference === "none") return preference;
  return "none";
}

export function imageSourceLabel(input: {
  preference?: ImagePreference | null;
  generatedUrl?: string | null;
  stockUrl?: string | null;
  assignmentUrl?: string | null;
  poolUrl?: string | null;
}): ImageSourceLabel {
  const picked = pickStageImage(input);
  if (picked.source === "ai") return "ai";
  if (picked.source === "pool") return "stock";
  return "none";
}

export function imageSourceLine(label: ImageSourceLabel) {
  if (label === "ai") return "AI";
  if (label === "stock") return "Stock";
  return "No image (gradient)";
}

export function attributionForPool(photographer?: string | null, source?: string | null) {
  if (!photographer && !source) return null;
  return `${photographer ?? "Unknown"} / ${source ?? "pool"}`;
}

function trimUrl(value?: string | null) {
  const next = value?.trim() || null;
  return next || null;
}
