/**
 * Next.js 14 `Image` has no `prefetch` helper. Preload the next slide's
 * bitmap so the audience cross-fade never flashes an empty frame.
 */
export function prefetchSlideImage(url: string | null | undefined) {
  if (!url || typeof window === "undefined") return;
  const image = new window.Image();
  image.decoding = "async";
  image.src = url;
}

export function prefetchUpcomingImages(
  urls: Array<string | null | undefined>,
  currentIndex: number,
  ahead = 1,
) {
  for (let i = 1; i <= ahead; i += 1) {
    prefetchSlideImage(urls[currentIndex + i] ?? null);
  }
}
