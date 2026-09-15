/**
 * Next.js 14 `Image` has no `prefetch` helper. Preload the next slide's
 * bitmap so the audience cross-fade never flashes an empty frame.
 */

export type VisualSlide = {
  generatedImageUrl?: string | null;
  imageUrl?: string | null;
};

export function slideStageImage(slide: VisualSlide | null | undefined) {
  if (!slide) return null;
  return slide.generatedImageUrl || slide.imageUrl || null;
}

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

export function injectPreloadLink(url: string | null | undefined) {
  if (!url || typeof document === "undefined") return;
  const links = document.head.querySelectorAll('link[rel="preload"][as="image"]');
  for (const node of links) {
    if (node instanceof HTMLLinkElement && node.href === url) return;
  }
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  document.head.appendChild(link);
}
