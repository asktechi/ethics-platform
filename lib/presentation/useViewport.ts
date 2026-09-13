"use client";

import { useEffect, useState } from "react";
import { setPaginationViewport } from "@/lib/presentation/beats";

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

/** Window size for audience layout. Debounced 150ms; teleprompter does not use this. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(EMPTY);

  useEffect(() => {
    let timer: number | null = null;
    const publish = () => {
      const next = readViewport();
      setPaginationViewport(next);
      setViewport(next);
      console.log("[phase46g] useViewport", next);
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
