import { useEffect, useRef } from "react";

const MAX_PULL_TOUCH = 56;
const MAX_PULL_WHEEL = 26;
const RESISTANCE = 140;
const WHEEL_SENSITIVITY = 0.6;
const WHEEL_IDLE_MS = 150;
const RELEASE_TRANSITION = "transform 380ms var(--forge-ease, ease-out)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getScroller() {
  return document.scrollingElement || document.documentElement;
}

function atTop(el) {
  return el.scrollTop <= 0;
}

function atBottom(el) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
}

function dampen(raw, maxPull) {
  const sign = raw > 0 ? 1 : raw < 0 ? -1 : 0;
  const abs = Math.abs(raw);
  return sign * maxPull * (1 - Math.exp(-abs / RESISTANCE));
}

function isIgnored(target) {
  return !!(target && target.closest && target.closest("[data-no-rubber-band]"));
}

export function useOverscrollBounce({ contentRef }) {
  const pullRef = useRef(0);
  const pendingRef = useRef(0);
  const rafRef = useRef(null);
  const touchStartYRef = useRef(0);
  const touchActiveRef = useRef(false);
  const wheelRawRef = useRef(0);
  const wheelTimerRef = useRef(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    const media = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    const onMediaChange = () => {
      reducedMotionRef.current = media.matches;
    };
    media?.addEventListener?.("change", onMediaChange);

    const applyPull = (value, animated) => {
      const content = contentRef.current;
      if (!content) return;

      const clamped = reducedMotionRef.current ? 0 : value;
      pullRef.current = clamped;

      content.style.transition = animated ? RELEASE_TRANSITION : "none";
      content.style.transform = clamped === 0 ? "" : `translate3d(0, ${clamped}px, 0)`;
    };

    const release = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = 0;
      wheelRawRef.current = 0;
      applyPull(0, true);
    };

    const scheduleFrame = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyPull(pendingRef.current, false);
      });
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      if (isIgnored(e.target)) return;
      touchStartYRef.current = e.touches[0].clientY;
      touchActiveRef.current = true;
    };

    const onTouchMove = (e) => {
      if (!touchActiveRef.current || e.touches.length !== 1) return;
      if (isIgnored(e.target)) return;

      const rawDelta = e.touches[0].clientY - touchStartYRef.current;
      if (rawDelta === 0) return;

      const scroller = getScroller();
      const pullingAtTop = rawDelta > 0 && atTop(scroller);
      const pullingAtBottom = rawDelta < 0 && atBottom(scroller);

      if (!pullingAtTop && !pullingAtBottom) {

        if (pullRef.current !== 0) release();
        return;
      }

      pendingRef.current = dampen(rawDelta, MAX_PULL_TOUCH);
      scheduleFrame();
    };

    const onTouchEnd = () => {
      touchActiveRef.current = false;
      release();
    };

    const onWheel = (e) => {
      if (isIgnored(e.target)) return;

      const scroller = getScroller();
      const pullingAtTop = e.deltaY < 0 && atTop(scroller);
      const pullingAtBottom = e.deltaY > 0 && atBottom(scroller);

      if (!pullingAtTop && !pullingAtBottom) {
        if (pullRef.current !== 0 && !touchActiveRef.current) release();
        return;
      }

      const direction = pullingAtTop ? 1 : -1;
      const nextRaw = wheelRawRef.current + direction * Math.abs(e.deltaY) * WHEEL_SENSITIVITY;
      const cap = RESISTANCE * 3;
      wheelRawRef.current = Math.max(-cap, Math.min(cap, nextRaw));

      pendingRef.current = dampen(wheelRawRef.current, MAX_PULL_WHEEL);
      scheduleFrame();

      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(release, WHEEL_IDLE_MS);
    };

    const onVisibilityOrBlur = () => {
      touchActiveRef.current = false;
      release();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("blur", onVisibilityOrBlur);
    document.addEventListener("visibilitychange", onVisibilityOrBlur);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("blur", onVisibilityOrBlur);
      document.removeEventListener("visibilitychange", onVisibilityOrBlur);
      media?.removeEventListener?.("change", onMediaChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [contentRef]);
}
