"use client";

/**
 * The page turn.
 *
 * A real leaf hinged on its left edge, not a slide or a fade. The things that
 * sell it are not the rotation: they are the shadow the lifting page casts on
 * the one beneath, the fact that the back of the leaf is a different surface
 * from the front, and that the motion eases out slowly rather than landing
 * hard, because paper has weight.
 *
 * Turned pages stay stacked on the left so the book visibly thickens on one
 * side and thins on the other. That is the whole reason to use a book at all.
 */

import { useEffect, useRef, useState } from "react";

export type LeafState = "unturned" | "turning" | "turned" | "unturning";

export function Leaf({
  index,
  current,
  total,
  children,
  back,
}: {
  index: number;
  current: number;
  total: number;
  children: React.ReactNode;
  /** What shows on the reverse while the leaf is mid-turn. */
  back?: React.ReactNode;
}) {
  const turned = index < current;
  const [animating, setAnimating] = useState(false);
  const previous = useRef(turned);

  useEffect(() => {
    if (previous.current !== turned) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 900);
      previous.current = turned;
      return () => clearTimeout(t);
    }
  }, [turned]);

  // The leaf on top of the unturned stack is the one you read.
  const depth = turned ? index : total - index;

  return (
    <div
      aria-hidden={index !== current}
      className="pointer-events-none absolute inset-0"
      style={{
        zIndex: depth,
        transformStyle: "preserve-3d",
        transformOrigin: "left center",
        transform: `rotateY(${turned ? -178 : 0}deg)`,
        transition: "transform 900ms cubic-bezier(0.22, 0.61, 0.24, 1)",
      }}
    >
      {/* front */}
      <div
        className="absolute inset-0 overflow-hidden rounded-r-[3px] bg-ink"
        style={{
          backfaceVisibility: "hidden",
          boxShadow: turned ? "none" : "var(--leaf-shadow)",
        }}
      >
        <div
          className={`h-full w-full ${index === current ? "pointer-events-auto" : ""}`}
        >
          {children}
        </div>

        {/* the gutter: darker paper where the page meets the spine */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-20"
          style={{ background: "var(--gutter)" }}
        />

        {/* light sweeping across the leaf as it lifts */}
        {animating ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--sweep)", animation: "sweep 900ms ease-out" }}
          />
        ) : null}
      </div>

      {/* reverse */}
      <div
        className="absolute inset-0 overflow-hidden rounded-l-[3px] bg-ink-soft"
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-24"
          style={{ background: "var(--gutter-verso)" }}
        />
        {back ?? null}
      </div>
    </div>
  );
}
