"use client";

import { useEffect, useState } from "react";

export type Viewport = {
  width: number;
  height: number;
  aspect: number;
};

const DEBOUNCE_MS = 150;
const EMPTY: Viewport = { width: 0, height: 0, aspect: 0 };

function readViewport(): Viewport {
  if (typeof window === "undefined") return EMPTY;
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    aspect: height > 0 ? width / height : 0,
  };
}

/**
 * Window size for audience chrome / overflow. Debounced 150ms.
 * Beat pagination does not use this — it stays on CANONICAL_VIEWPORT.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(EMPTY);

  useEffect(() => {
    let timer: number | null = null;
    const publish = () => {
      setViewport(readViewport());
    };
    const onChange = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(publish, DEBOUNCE_MS);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    publish();
    const later = window.setTimeout(publish, 1000);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.clearTimeout(later);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return viewport;
}
