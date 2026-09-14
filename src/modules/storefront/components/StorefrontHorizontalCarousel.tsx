"use client";

import { useEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";

export function StorefrontHorizontalCarousel({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ atStart: true, atEnd: true });

  const updatePosition = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    setPosition({
      atStart: viewport.scrollLeft <= 2,
      atEnd: maxScroll <= 2 || viewport.scrollLeft >= maxScroll - 2,
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(viewport);
    viewport.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", updatePosition);
    };
  }, [children]);

  const move = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.82, 240),
      behavior: "smooth",
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const canMove =
      event.deltaY < 0 ? viewport.scrollLeft > 1 : viewport.scrollLeft < maxScroll - 1;
    if (!canMove) return;
    event.preventDefault();
    viewport.scrollBy({ left: event.deltaY, behavior: "auto" });
  };

  return (
    <div className="relative mt-7">
      <div
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
        }}
        onWheel={handleWheel}
        ref={viewportRef}
        role="region"
        tabIndex={0}
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center gap-2 pl-8 md:flex">
        <button
          aria-label="Desplazar carrusel a la izquierda"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-white text-xl font-bold text-[var(--color-title)] shadow-sm transition hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={position.atStart}
          onClick={() => move(-1)}
          type="button"
        >
          ‹
        </button>
        <button
          aria-label="Desplazar carrusel a la derecha"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-white text-xl font-bold text-[var(--color-title)] shadow-sm transition hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={position.atEnd}
          onClick={() => move(1)}
          type="button"
        >
          ›
        </button>
      </div>
    </div>
  );
}
