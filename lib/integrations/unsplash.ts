import "server-only";

import type { UnsplashImage } from "@/lib/integrations/unsplash.types";

export type { UnsplashImage };

export class MissingApiKeyError extends Error {
  readonly code = "MISSING_API_KEY";

  constructor(service = "UNSPLASH_ACCESS_KEY") {
    super(`Set ${service} to enable image pools.`);
    this.name = "MissingApiKeyError";
  }
}

export function hasUnsplashKey(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY?.trim());
}

export async function searchImages(
  query: string,
  options: { count?: number; orientation?: "landscape" | "portrait" | "squarish" } = {},
): Promise<UnsplashImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) throw new MissingApiKeyError();

  const count = Math.min(Math.max(options.count ?? 24, 1), 30);
  const orientation = options.orientation ?? "landscape";
  const params = new URLSearchParams({
    query: query.trim() || "professional ethics",
    per_page: String(count),
    orientation,
  });

  const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: {
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unsplash search failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      id: string;
      urls?: { regular?: string; small?: string; thumb?: string };
      user?: { name?: string };
      links?: { html?: string };
    }>;
  };

  return (payload.results ?? []).map((photo) => ({
    id: photo.id,
    url: photo.urls?.regular ?? photo.urls?.small ?? "",
    thumb_url: photo.urls?.small ?? photo.urls?.thumb ?? photo.urls?.regular ?? "",
    photographer: photo.user?.name ?? "Unknown photographer",
    source_url: photo.links?.html ?? "https://unsplash.com",
  }));
}
