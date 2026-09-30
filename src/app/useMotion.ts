// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useMemo, useRef } from "react";

// Which way is down, how the phone turns and how hard it is shaken — read
// off the phone, for the sand, the glass and the sky.
//
// An hourglass is turned over by turning it over, and tilted by tilting it,
// so the phone is the glass: turned upside down, the sand runs the other
// way; held at a slant — to either side, or leaned back or forward — the
// heaps lean into it and slide to that side, or to the back or the front of
// the bulb; shaken, the grains jump. The glass on the screen stays where it
// is, give or take the lag of a heavy thing held in a hand, because it is
// the phone that moved; the sky behind it stays level with the world.
//
// What the sand needs is gravity in the phone's own frame: `down`, x to the
// right of the screen, y up it, z out of it toward the face — the three
// shares of one g, from the orientation angles (`deviceDown`). Which way up
// the glass is flips with a wide hysteresis — past a third of a right angle
// beyond level, either way — so a phone carried flat does not turn its
// glass over at every jolt. The lean is gravity across the glass over its
// share along it (`leanOf`), capped where a heap on a floor stops making
// sense. A phone laid flat on a table leans its sand to the back of the
// bulb, and goes on running: the run halts only on its side, where the hole
// is no longer fed (`leanStops`), because a timer that stopped whenever the
// phone was put down would be a worse hourglass than one that runs true.
//
// The motion is the phone's own acceleration with gravity taken out, and
// how fast it turns (the gyroscope): the glass lags a quick turn and swings
// back (`view.ts`), and a jerk of the phone throws the sand the other way
// (`physics.ts`). The shake is that acceleration's strength, as a share of
// a hard shake.
//
// The readings never leave the frame they decide: nothing is stored,
// nothing is sent; the reading is the only thing that survives one, and it
// lives in a ref rather than in state, because a sensor reports sixty times
// a second and a render for each would be a screen redrawn for nothing.
//
// On iOS both sensors need the user's permission, and Safari grants it only
// from a gesture it counts as one — a tap's END (`click`, `touchend`), not
// the press that starts it — and only for the first request made in it. So
// `requestMotion` asks for both at once, synchronously in that gesture, and
// the app asks from the glass's click. The listeners go on from the start
// regardless: a phone that granted it before reports at once, and a
// reading is the proof it was granted.

/** Down the screen (1) or up it (−1). */
export type Gravity = 1 | -1;

export type Vec3 = [number, number, number];

/** One reading of the phone. */
export type Reading = {
  /** Which way up the glass is: down the screen, or up it. */
  gravity: Gravity;
  /** Gravity in the phone's frame, one g long: x right, y up the screen,
   *  z out of it. */
  down: Vec3;
  /** Gravity's lean across the glass, as tangents over its share along
   *  it: `x` to the right, `z` toward the face. Capped at `MAX_LEAN`. */
  lean: { x: number; z: number };
  /** The orientation angles, degrees — what the sky is turned by — or
   *  null until the sensor has said. */
  angles: { alpha: number; beta: number; gamma: number } | null;
  /** The phone's own acceleration, gravity taken out, m/s², phone frame. */
  accel: Vec3;
  /** How fast the phone turns, rad/s, about its x, y and z. */
  spin: Vec3;
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

/** The lean to the side past which the hole is no longer fed and the sand
 *  stops: sixty degrees, as a tangent. */
export const STOP_LEAN = Math.tan((60 * Math.PI) / 180);

/** The acceleration, in m/s², that counts as a full shake, and the one
 *  below which nothing counts at all — a phone carried in a hand. */
const SHAKE_FULL = 18;
const SHAKE_FLOOR = 2.5;

const DEG = Math.PI / 180;

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

/**
 * Ask, from a user gesture's end (a click), for both sensors. Both
 * requests are made before either is awaited: Safari lets a gesture grant
 * one request, and a second made after an `await` is outside it and fails
 * — which is how a phone ends up with the tilt but never the shake, or
 * neither. Resolves to whether orientation readings will come.
 */
export function requestMotion(): Promise<boolean> {
  const w = window as {
    DeviceOrientationEvent?: Permitting;
    DeviceMotionEvent?: Permitting;
  };
  let orientation: Promise<"granted" | "denied">;
  let motion: Promise<"granted" | "denied">;
  try {
    orientation = w.DeviceOrientationEvent?.requestPermission
      ? w.DeviceOrientationEvent.requestPermission()
      : Promise.resolve("granted");
    motion = w.DeviceMotionEvent?.requestPermission
      ? w.DeviceMotionEvent.requestPermission()
      : Promise.resolve("granted");
  } catch {
    return Promise.resolve(false);
  }
  return Promise.all([
    orientation.catch(() => "denied" as const),
    // The shake is welcome but not needed: a refusal here still leaves the
    // turn and the lean.
    motion.catch(() => "denied" as const),
  ]).then(([o]) => o === "granted");
}

/**
 * Gravity in the phone's frame from the front-back tilt `beta` and the
 * left-right tilt `gamma`, degrees: one g, x to the right of the screen, y
 * up it, z out of it. The specification's rotation with the compass
 * heading left out, which gravity does not depend on. Null when there is
 * no reading.
 */
export function deviceDown(
  beta: number | null,
  gamma: number | null,
): Vec3 | null {
  if (beta === null || !Number.isFinite(beta)) return null;
  const b = beta * DEG;
  const g = (gamma ?? 0) * DEG;
  return [Math.cos(b) * Math.sin(g), -Math.sin(b), -Math.cos(b) * Math.cos(g)];
}

/** Gravity in the screen's terms: its share down the screen (+1 for an
 *  upright phone, −1 for one held upside down), to the right, and toward
 *  the face (negative: into the screen, a phone leaned back). */
export function screenGravity(
  beta: number | null,
  gamma: number | null,
): { down: number; across: number; toward: number } | null {
  const d = deviceDown(beta, gamma);
  if (!d) return null;
  return { down: -d[1], across: d[0], toward: d[2] };
}

/** The sign of gravity along the screen from one reading: +1 for an
 *  upright phone and −1 for one held upside down. Null when there is no
 *  reading. */
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

/**
 * The lean the heaps hold for a reading, given which way up the glass is:
 * across and toward over down, in the glass's own sense, capped as a
 * whole at `MAX_LEAN` (a phone laid flat leans its sand the full way to
 * the back). Null when there is no reading.
 */
export function leanOf(
  reading: { down: number; across: number; toward?: number } | null,
  gravity: Gravity,
): { x: number; z: number } | null {
  if (!reading) return null;
  const { down, across } = reading;
  const toward = reading.toward ?? 0;
  const along = Math.max(1e-6, down * gravity);
  let x = across / along;
  let z = toward / along;
  const t = Math.hypot(x, z);
  if (t > MAX_LEAN) {
    x *= MAX_LEAN / t;
    z *= MAX_LEAN / t;
  }
  return { x, z };
}

/** Whether a lean to the side has the sand stopped: past it the hole is
 *  not fed. A lean to the back or front never stops it. */
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

/**
 * The phone's orientation as a rotation from its own frame (x right, y up
 * the screen, z out of it) into the Earth's (x east, y north, z up), row
 * major: the specification's Z·X′·Y″ from `alpha`, `beta`, `gamma`,
 * degrees. What turns the sky: a direction on the screen times it is the
 * direction in the world it looks along.
 */
export function deviceToEarth(
  alpha: number,
  beta: number,
  gamma: number,
): number[] {
  const a = alpha * DEG;
  const b = beta * DEG;
  const g = gamma * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cb = Math.cos(b);
  const sb = Math.sin(b);
  const cg = Math.cos(g);
  const sg = Math.sin(g);
  return [
    ca * cg - sa * sb * sg,
    -sa * cb,
    ca * sg + sa * sb * cg,
    sa * cg + ca * sb * sg,
    ca * cb,
    sa * sg - ca * sb * cg,
    -cb * sg,
    sb,
    cb * cg,
  ];
}

/** The readings, live, and who to tell when one arrives. */
export type Motion = {
  /** The latest reading; read it, never write it. */
  current: Reading;
  /** Called on every reading that changed something. */
  subscribe: (fn: () => void) => () => void;
};

export const STILL: Reading = {
  gravity: 1,
  down: [0, -1, 0],
  lean: { x: 0, z: 0 },
  angles: null,
  accel: [0, 0, 0],
  spin: [0, 0, 0],
  shake: 0,
  heard: false,
};

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
      const down = deviceDown(e.beta, e.gamma);
      if (!g || !down) return;
      const was = current.current;
      // The first reading says which way up the phone already is.
      if (!was.heard) last.current = g.down < 0 ? -1 : 1;
      const next = nextGravity(last.current, g.down);
      last.current = next;
      const lean = leanOf(g, next) ?? was.lean;
      // A phone held still still reports, sixty times a second; only a
      // reading that moves something is worth waking the glass for.
      const moved =
        !was.heard ||
        was.gravity !== next ||
        Math.abs(was.down[0] - down[0]) +
          Math.abs(was.down[1] - down[1]) +
          Math.abs(was.down[2] - down[2]) >
          0.003 ||
        Math.abs((was.angles?.alpha ?? 0) - (e.alpha ?? 0)) > 0.3;
      current.current = {
        ...was,
        gravity: next,
        down,
        lean,
        angles: { alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 },
        heard: true,
      };
      if (moved) tell();
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      const r = e.rotationRate;
      const was = current.current;
      const accel: Vec3 =
        a && a.x !== null && a.y !== null && a.z !== null
          ? [a.x, a.y, a.z]
          : was.accel;
      const spin: Vec3 =
        r && r.alpha !== null && r.beta !== null && r.gamma !== null
          ? [r.beta * DEG, r.gamma * DEG, r.alpha * DEG]
          : was.spin;
      const shake = shakeOf(accel[0], accel[1], accel[2]);
      current.current = { ...was, accel, spin, shake, heard: true };
      // A hand's tremor is not a push: only a turn or a jolt the glass
      // would show wakes it.
      if (
        shake > 0 ||
        Math.hypot(accel[0], accel[1], accel[2]) > 0.6 ||
        Math.hypot(spin[0], spin[1], spin[2]) > 0.08
      ) {
        tell();
      }
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
