"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_THROTTLE_MS = 100;
const AUTO_SCROLL_DEBOUNCE_MS = 400;
const LIVE_THRESHOLD_PX = 100;

export function useAudienceScroll(options: {
  /** When false (host mirror), auto-follow stays on and the jump pill never appears. */
  trackUserScroll: boolean;
  revealKey: string;
  resetKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const autoTargetRef = useRef(0);
  const autoScrollingRef = useRef(false);
  const lastAutoRef = useRef(0);
  const throttleRef = useRef(0);

  const computeTarget = useCallback(() => {
    const container = containerRef.current;
    const el = currentLineRef.current;
    if (!container || !el) return 0;
    const frame = container.getBoundingClientRect();
    const card = el.getBoundingClientRect();
    return (
      container.scrollTop + (card.top - frame.top) - container.clientHeight / 2 + card.height / 2
    );
  }, []);

  const scrollToCurrent = useCallback(
    (behavior: ScrollBehavior) => {
      const container = containerRef.current;
      if (!container) return;
      const top = Math.max(0, computeTarget());
      autoTargetRef.current = top;
      autoScrollingRef.current = true;
      container.scrollTo({ top, behavior });
      window.setTimeout(
        () => {
          autoScrollingRef.current = false;
          autoTargetRef.current = computeTarget();
        },
        behavior === "smooth" ? 480 : 60,
      );
    },
    [computeTarget],
  );

  const jumpToLive = useCallback(() => {
    setUserScrolledUp(false);
    scrollToCurrent("smooth");
  }, [scrollToCurrent]);

  useEffect(() => {
    setUserScrolledUp(false);
    const container = containerRef.current;
    if (container) {
      autoScrollingRef.current = true;
      container.scrollTo({ top: 0, behavior: "auto" });
      autoTargetRef.current = 0;
      window.setTimeout(() => {
        autoScrollingRef.current = false;
      }, 60);
    }
  }, [options.resetKey]);

  useEffect(() => {
    if (options.trackUserScroll && userScrolledUp) return;
    const now = Date.now();
    const wait = Math.max(0, AUTO_SCROLL_DEBOUNCE_MS - (now - lastAutoRef.current));
    const timer = window.setTimeout(() => {
      lastAutoRef.current = Date.now();
      scrollToCurrent("smooth");
    }, wait);
    return () => window.clearTimeout(timer);
  }, [options.revealKey, options.resetKey, options.trackUserScroll, userScrolledUp, scrollToCurrent]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !options.trackUserScroll) return;
    const onScroll = () => {
      if (autoScrollingRef.current) return;
      const now = Date.now();
      if (now - throttleRef.current < SCROLL_THROTTLE_MS) return;
      throttleRef.current = now;
      const away = node.scrollTop < autoTargetRef.current - LIVE_THRESHOLD_PX;
      setUserScrolledUp(away);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [options.trackUserScroll]);

  return {
    containerRef,
    currentLineRef,
    isLive: !userScrolledUp,
    userScrolledUp,
    jumpToLive,
  };
}
