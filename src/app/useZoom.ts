// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";

import { clampZoom, zoomFor } from "./timer.ts";

// How big the glass is drawn, by a pinch: two fingers on the glass, a
// trackpad's pinch (Safari's `gesture*` events; the wheel with Ctrl to
// Chrome and Firefox), the wheel, or + and −. A size and nothing else —
// the length and the run are not touched (`shownSize` in `timer.ts`).
//
// The zoom lives in a ref while a gesture is under way, read by the
// glass's loop every frame, and is kept in the settings once the gesture
// rests: a pinch reports sixty times a second, and a settings write for
// each would be a render and a localStorage write for nothing.

/** How much the wheel zooms, as a factor a pixel of its travel, and a
 *  trackpad's pinch, which comes as the wheel with Ctrl held in much
 *  smaller steps; how long after the wheel stops the zoom is kept. */
const WHEEL_ZOOM = 0.0015;
const PINCH_ZOOM = 0.01;
const KEEP_MS = 400;

/** How much one press of + or − zooms. */
export const KEY_ZOOM = 1.15;

/** Who is pinching: fingers on the glass (pointers), or Safari's own
 *  gesture events — which iOS sends for a two-finger pinch as well, so
 *  the first to start a pinch has it to itself until it ends. */
export type Pincher = "pointers" | "gesture";

export type Zoom = {
  /** The zoom now, gesture and all. */
  now: MutableRefObject<number>;
  /** A pinch starts: the zoom it starts from, or null when another
   *  pincher already has it. */
  begin: (who: Pincher) => number | null;
  /** The zoom a pinch has made, held to what the glass can be shown at. */
  pinch: (who: Pincher, next: number) => void;
  /** The pinch is over: kept. */
  end: (who: Pincher) => void;
  /** One step bigger (above one) or smaller, kept a moment later. */
  nudge: (factor: number) => void;
  onWheel: (e: WheelEvent) => void;
};

export function useZoom(
  zoom: number,
  minutes: number,
  onZoom: (zoom: number) => void,
  wake: () => void,
  host: RefObject<HTMLElement | null>,
): Zoom {
  const now = useRef(zoom);
  const active = useRef<Pincher | null>(null);
  const timer = useRef<number | null>(null);
  const kept = useRef(zoom);
  // A new zoom from the settings is taken up, unless a gesture is making
  // one of its own.
  if (kept.current !== zoom) {
    kept.current = zoom;
    if (active.current === null && timer.current === null) now.current = zoom;
  }
  const keep = useRef(onZoom);
  keep.current = onZoom;
  const length = useRef(minutes);
  length.current = minutes;

  const to = useCallback(
    (next: number) => {
      const z = zoomFor(length.current, next);
      if (z === now.current) return;
      now.current = z;
      wake();
    },
    [wake],
  );
  const store = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const z = clampZoom(now.current);
    if (Math.abs(z - kept.current) > 1e-6) keep.current(z);
  }, []);
  const storeSoon = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(store, KEEP_MS);
  }, [store]);
  const begin = useCallback((who: Pincher) => {
    if (active.current !== null && active.current !== who) return null;
    active.current = who;
    return now.current;
  }, []);
  const pinch = useCallback(
    (who: Pincher, next: number) => {
      if (active.current === who) to(next);
    },
    [to],
  );
  const end = useCallback(
    (who: Pincher) => {
      if (active.current !== who) return;
      active.current = null;
      store();
    },
    [store],
  );
  const nudge = useCallback(
    (factor: number) => {
      to(now.current * factor);
      storeSoon();
    },
    [to, storeSoon],
  );
  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      to(now.current * Math.exp(-px * (e.ctrlKey ? PINCH_ZOOM : WHEEL_ZOOM)));
      storeSoon();
    },
    [to, storeSoon],
  );

  // Safari's trackpad pinch, which is neither pointers nor the wheel.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let from: number | null = null;
    const start = (e: Event) => {
      e.preventDefault();
      from = begin("gesture");
    };
    const change = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale?: number }).scale ?? 1;
      if (from !== null) pinch("gesture", from * scale);
    };
    const finish = (e: Event) => {
      e.preventDefault();
      end("gesture");
      from = null;
    };
    el.addEventListener("gesturestart", start);
    el.addEventListener("gesturechange", change);
    el.addEventListener("gestureend", finish);
    return () => {
      el.removeEventListener("gesturestart", start);
      el.removeEventListener("gesturechange", change);
      el.removeEventListener("gestureend", finish);
    };
  }, [host, begin, pinch, end]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { now, begin, pinch, end, nudge, onWheel };
}
