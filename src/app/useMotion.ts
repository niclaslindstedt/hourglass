// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef } from "react";

// Which way is down, and how hard the phone is being shaken — read off the
// phone, for the sand.
//
// An hourglass is turned over by turning it over, and tilted by tilting it,
// so the phone is the glass: when it is turned upside down the sand runs
// the other way, when it is held at a slant the heaps lean into the slant,
// and when it is shaken the grains jump — and the glass on the screen stays
// exactly where it is, because it is the phone that moved, not the picture.
//
// What the sand needs is gravity in the screen's own plane: how much of it
// points down the screen (`down`, +1 upright, −1 upside down) and how much
// across it (`across`, + to the right). The share into the screen changes
// nothing — a phone laid flat on a table is a glass that goes on running,
// because a timer that stopped whenever the phone was put down would be a
// worse hourglass than one that runs true — so it is dropped and the two
// that are left are read as a direction. When the phone is so nearly flat
// that the direction is noise, the last good one is kept.
//
// Which way up the glass is flips with a wide hysteresis — past a third of
// a right angle beyond level, either way — so a phone carried flat does
// not turn its glass over at every jolt. The lean is the rest of the angle:
// gravity's share across the screen over its share down it, capped where a
// glass on its side stops making sense as a heap on a floor.
//
// The shake is the phone's own acceleration with gravity taken out, as a
// share of a hard shake. It decays on the next reading rather than being
// held, so a shake is a moment rather than a state.
//
// The readings never leave the frame they decide: nothing is stored,
// nothing is sent; the reading is the only thing that survives one, and it
// lives in a ref rather than in state, because a sensor reports sixty times
// a second and a render for each would be a screen redrawn for nothing.
//
// On iOS both sensors need the user's permission, asked from a tap
// (`requestMotion`); elsewhere they need nothing.

/** Down the screen (1) or up it (−1). */
export type Gravity = 1 | -1;

/** One reading of the phone, in the screen's plane. */
export type Reading = {
  /** Which way up the glass is: down the screen, or up it. */
  gravity: Gravity;
  /** Gravity's lean across the screen, as a tangent: its share across over
   *  its share along, positive to the right. Capped at `MAX_LEAN`. */
  lean: number;
  /** How hard the phone is being shaken now, 0..1. */
  shake: number;
  /** Whether a sensor has said anything yet. */
  heard: boolean;
};

/** How far past level, as sine, before the glass counts as turned. */
export const FLIP_AT = 0.35;

/** The steepest lean the heaps are asked to hold, as a tangent: seventy
 *  degrees. Past it a glass is on its side. */
export const MAX_LEAN = Math.tan((70 * Math.PI) / 180);

/** The lean past which the hole is no longer fed and the sand stops:
 *  sixty degrees, as a tangent. */
export const STOP_LEAN = Math.tan((60 * Math.PI) / 180);

/** Below this share of gravity in the screen's plane the phone is flat and
 *  the direction is noise: the last good one is kept. */
const FLAT = 0.25;

/** The acceleration, in m/s², that counts as a full shake, and the one
 *  below which nothing counts at all — a phone carried in a hand. */
const SHAKE_FULL = 18;
const SHAKE_FLOOR = 2.5;

type Permitting = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Whether this device asks before it reports orientation (iOS). */
export function motionNeedsPermission(): boolean {
  if (typeof window === "undefined") return false;
  const ctor = (window as { DeviceOrientationEvent?: Permitting })
    .DeviceOrientationEvent;
  return typeof ctor?.requestPermission === "function";
}

/** Ask, from a user gesture, for both sensors. Resolves to whether
 *  readings will come. */
export async function requestMotion(): Promise<boolean> {
  const w = window as {
    DeviceOrientationEvent?: Permitting;
    DeviceMotionEvent?: Permitting;
  };
  try {
    const orientation = w.DeviceOrientationEvent?.requestPermission
      ? await w.DeviceOrientationEvent.requestPermission()
      : "granted";
    if (orientation !== "granted") return false;
    if (w.DeviceMotionEvent?.requestPermission) {
      // The shake is welcome but not needed: a refusal here still leaves
      // the turn and the lean.
      await w.DeviceMotionEvent.requestPermission().catch(() => "denied");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Gravity in the screen's plane from one orientation reading: `down` is
 * its share down the screen (+1 for an upright phone, −1 for one held
 * upside down) and `across` its share to the right, from the front-back
 * tilt `beta` and the left-right tilt `gamma`. Null when there is no
 * reading. The derivation is the specification's rotation, with the
 * compass heading left out, which gravity does not depend on.
 */
export function screenGravity(
  beta: number | null,
  gamma: number | null,
): { down: number; across: number } | null {
  if (beta === null || !Number.isFinite(beta)) return null;
  const b = (beta * Math.PI) / 180;
  const g = ((gamma ?? 0) * Math.PI) / 180;
  return { down: Math.sin(b), across: Math.sin(g) * Math.cos(b) };
}

/** The sign of gravity along the screen from one reading: the sine of the
 *  front-back tilt, +1 for an upright phone and −1 for one held upside
 *  down. Null when there is no reading. */
export function gravitySign(beta: number | null): number | null {
  return screenGravity(beta, 0)?.down ?? null;
}

/** The next gravity, given the last and a fresh sign: a flip only past the
 *  hysteresis, either way. */
export function nextGravity(last: Gravity, sign: number | null): Gravity {
  if (sign === null) return last;
  if (last === 1 && sign < -FLIP_AT) return -1;
  if (last === -1 && sign > FLIP_AT) return 1;
  return last;
}

/** The lean the heaps hold for a reading, given which way up the glass
 *  is: across over down, in the glass's own sense, capped. Null when the
 *  phone is too flat for the direction to mean anything. */
export function leanOf(
  reading: { down: number; across: number } | null,
  gravity: Gravity,
): number | null {
  if (!reading) return null;
  const { down, across } = reading;
  if (Math.hypot(down, across) < FLAT) return null;
  const along = Math.max(1e-6, down * gravity);
  return Math.max(-MAX_LEAN, Math.min(MAX_LEAN, across / along));
}

/** Whether a lean has the sand stopped: past it the hole is not fed. */
export function leanStops(lean: number): boolean {
  return Math.abs(lean) > STOP_LEAN;
}

/** How hard a shake an acceleration is, 0..1: nothing below a hand's
 *  carrying, everything above a hard shake. */
export function shakeOf(x: number, y: number, z: number): number {
  const a = Math.hypot(x, y, z);
  return Math.min(
    1,
    Math.max(0, (a - SHAKE_FLOOR) / (SHAKE_FULL - SHAKE_FLOOR)),
  );
}

/** The readings, live, and who to tell when one arrives. */
export type Motion = {
  /** The latest reading; read it, never write it. */
  current: Reading;
  /** Called on every reading that changed something. */
  subscribe: (fn: () => void) => () => void;
};

const STILL: Reading = { gravity: 1, lean: 0, shake: 0, heard: false };

/**
 * The phone's readings, live. `enabled` off means no listener at all — and
 * a glass standing straight and still, which is what a desk and a phone
 * without a sensor get. The first orientation reading sets which way up the
 * glass already is, rather than turning it.
 */
export function useMotion(enabled: boolean): Motion {
  const current = useRef<Reading>({ ...STILL });
  const listeners = useRef(new Set<() => void>());
  const last = useRef<Gravity>(1);

  const motion = useMemo<Motion>(
    () => ({
      get current() {
        return current.current;
      },
      subscribe(fn) {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      current.current = { ...STILL };
      last.current = 1;
      return;
    }
    const tell = () => {
      for (const fn of listeners.current) fn();
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      const g = screenGravity(e.beta, e.gamma);
      if (!g) return;
      const was = current.current;
      if (!was.heard) {
        // The first reading says which way up the phone already is.
        last.current = g.down < 0 ? -1 : 1;
      }
      const next = nextGravity(last.current, g.down);
      last.current = next;
      const lean = leanOf(g, next) ?? was.lean;
      if (
        was.heard &&
        was.gravity === next &&
        Math.abs(was.lean - lean) < 0.004
      ) {
        return;
      }
      current.current = { gravity: next, lean, shake: was.shake, heard: true };
      tell();
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const shake = shakeOf(a.x, a.y, a.z);
      const was = current.current;
      if (shake === 0 && was.shake === 0) return;
      current.current = { ...was, shake, heard: true };
      tell();
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [enabled]);

  return motion;
}
