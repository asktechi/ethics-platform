"use client";

import { useEffect, useState } from "react";
import { CANONICAL_VIEWPORT } from "@/lib/presentation/beats";

export type Viewport = {
  width: number;
  height: number;
  aspect: number;
};

const DEBOUNCE_MS = 150;

function readViewport(): Viewport {
  if (typeof window === "undefined") {
    return {
      width: CANONICAL_VIEWPORT.width,
      height: CANONICAL_VIEWPORT.height,
      aspect: CANONICAL_VIEWPORT.width / CANONICAL_VIEWPORT.height,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    aspect: height > 0 ? width / height : 16 / 9,
  };
}

/** Window size for audience layout. Debounced 150ms; teleprompter does not use this. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const publish = () => setViewport(readViewport());
    const onChange = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(publish, DEBOUNCE_MS);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    publish();
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return viewport;
}
