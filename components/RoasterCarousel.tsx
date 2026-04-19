"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { RoasterCard } from "@/components/RoasterCard";
import type { Roaster } from "@/lib/data";

type RoasterCarouselProps = {
  roasters: Roaster[];
};

const AUTO_SPEED_PX_PER_SEC = 34;
const CARD_STEP = 227;

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d={direction === "right" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function normalizeOffset(offset: number, loopWidth: number) {
  if (loopWidth <= 0) {
    return offset;
  }

  let next = offset;
  while (next <= -loopWidth) {
    next += loopWidth;
  }
  while (next > 0) {
    next -= loopWidth;
  }
  return next;
}

export function RoasterCarousel({ roasters }: RoasterCarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const loopWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const isHoveringRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const resumeAfterRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const draggedDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const manualStopRef = useRef(false);

  const applyOffset = (nextOffset: number) => {
    const normalized = normalizeOffset(nextOffset, loopWidthRef.current);
    offsetRef.current = normalized;
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${normalized}px, 0, 0)`;
    }
  };

  useEffect(() => {
    const updateLoopWidth = () => {
      loopWidthRef.current = firstSetRef.current?.offsetWidth ?? 0;
      applyOffset(offsetRef.current);
    };

    updateLoopWidth();
    window.addEventListener("resize", updateLoopWidth);
    return () => {
      window.removeEventListener("resize", updateLoopWidth);
    };
  }, [roasters.length]);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const shouldPause =
        isHoveringRef.current ||
        isDraggingRef.current ||
        Date.now() < resumeAfterRef.current ||
        manualStopRef.current;

      if (!shouldPause && loopWidthRef.current > 0) {
        const next = offsetRef.current - AUTO_SPEED_PX_PER_SEC * dt;
        applyOffset(next);
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (
      event.pointerType !== "mouse" &&
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    isPointerDownRef.current = true;
    activePointerIdRef.current = event.pointerId;
    resumeAfterRef.current = Number.MAX_SAFE_INTEGER;
    draggedDistanceRef.current = 0;
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetRef.current;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !isPointerDownRef.current ||
      activePointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    const delta = event.clientX - dragStartXRef.current;
    const absoluteDelta = Math.abs(delta);

    if (!isDraggingRef.current) {
      if (absoluteDelta < 6) {
        return;
      }

      isDraggingRef.current = true;
      setIsDragging(true);

      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    event.preventDefault();
    draggedDistanceRef.current = Math.max(draggedDistanceRef.current, absoluteDelta);
    applyOffset(dragStartOffsetRef.current + delta);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !isPointerDownRef.current ||
      activePointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    isPointerDownRef.current = false;
    activePointerIdRef.current = null;

    if (!isDraggingRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      resumeAfterRef.current = manualStopRef.current
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + 2000;
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);
    resumeAfterRef.current = manualStopRef.current
      ? Number.MAX_SAFE_INTEGER
      : Date.now() + 2000;
    if (draggedDistanceRef.current > 7) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (roasters.length === 0) {
    return null;
  }

  const stopAutoAndStep = (direction: "left" | "right") => {
    manualStopRef.current = true;
    resumeAfterRef.current = Number.MAX_SAFE_INTEGER;
    const delta = direction === "right" ? -CARD_STEP : CARD_STEP;
    applyOffset(offsetRef.current + delta);
  };

  return (
    <div className="reveal relative mx-auto mt-7 max-w-[980px] pb-4">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[var(--page-bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[var(--page-bg)] to-transparent" />

      {roasters.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="المحمصة التالية"
            onClick={() => stopAutoAndStep("right")}
            className="theme-surface absolute right-[-52px] top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--page-muted)] backdrop-blur-xl transition duration-300 hover:text-[var(--page-fg)] md:grid"
          >
            <ArrowIcon direction="right" />
          </button>
          <button
            type="button"
            aria-label="المحمصة السابقة"
            onClick={() => stopAutoAndStep("left")}
            className="theme-surface absolute left-[-52px] top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--page-muted)] backdrop-blur-xl transition duration-300 hover:text-[var(--page-fg)] md:grid"
          >
            <ArrowIcon direction="left" />
          </button>
        </>
      ) : null}

      <div
        ref={viewportRef}
        className={`theme-surface-soft relative overflow-hidden rounded-[22px] border border-[color:var(--page-line)] p-2 pb-3 touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseEnter={() => {
          isHoveringRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveringRef.current = false;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div
          ref={trackRef}
          dir="ltr"
          className="flex will-change-transform pt-1"
          style={{ transform: "translate3d(0,0,0)" }}
        >
          <div ref={firstSetRef} className="flex gap-3 pr-3">
            {roasters.map((roaster, index) => (
              <div
                key={roaster.slug}
                className="min-w-[214px] max-w-[214px] shrink-0"
              >
                <RoasterCard roaster={roaster} priority={index < 2} />
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="flex gap-3 pr-3">
            {roasters.map((roaster) => (
              <div
                key={`${roaster.slug}-clone`}
                className="min-w-[214px] max-w-[214px] shrink-0"
              >
                <RoasterCard roaster={roaster} />
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
