export type ImagePreference = "auto" | "pool" | "ai" | "none";

export type StageImageSource = "ai" | "pool" | "none";

/**
 * Priority for the audience / host-mirror backdrop:
 * 1. generated AI image (Phase 7.5 hook)
 * 2. theme_assignment.image_url (curated pool, snapshotted onto the run)
 * 3. live concept / class locked pool
 * 4. gradient (null)
 */
export function pickStageImage(input: {
  preference?: ImagePreference | null;
  generatedUrl?: string | null;
  assignmentUrl?: string | null;
  poolUrl?: string | null;
}): { url: string | null; source: StageImageSource } {
  const preference = input.preference ?? "auto";
  if (preference === "none") return { url: null, source: "none" };

  const generated = input.generatedUrl?.trim() || null;
  const assignment = input.assignmentUrl?.trim() || null;
  const pool = input.poolUrl?.trim() || null;
  const curated = assignment || pool;

  if (preference === "ai") {
    return { url: generated, source: generated ? "ai" : "none" };
  }
  if (preference === "pool") {
    return { url: curated, source: curated ? "pool" : "none" };
  }
  if (generated) return { url: generated, source: "ai" };
  if (curated) return { url: curated, source: "pool" };
  return { url: null, source: "none" };
}

export function attributionForPool(photographer?: string | null, source?: string | null) {
  if (!photographer && !source) return null;
  return `${photographer ?? "Unknown"} / ${source ?? "pool"}`;
}
