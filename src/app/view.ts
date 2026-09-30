// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Vec3 } from "./useMotion.ts";

// How the glass hangs in the phone: a heavy thing in a hand, not a picture
// painted on the glass of the screen.
//
// Two motions, both springs with a damper, so both settle back to a glass
// seen head on:
//
//   THE LAG. The glass is held to the phone by a stiff spring. Turn the
//   phone quickly and the glass, having inertia, is left behind for a
//   moment — you see a little of its side, or its top — then catches up
//   and swings a hair past before it settles. It is the phone's angular
//   ACCELERATION that kicks it (a steady turn leaves it trailing by a
//   little; a stop swings it back), which is what makes the picture feel
//   weighted rather than stuck on. Subtle on purpose: a few degrees.
//
//   THE ORBIT. A finger dragged sideways across the glass turns it about
//   its own axis, and let go it spins on and slows, and eases back to face
//   the viewer — the way to look at the sand from another side.
//
// Both are in radians about the phone's own axes (x right, y up the
// screen, z out of it).
//
// And under both, THE FOLLOW (`follow`): a phone's sensors report sixty
// times a second with a tremor in every reading, and a glass turned or
// pushed by each raw one jitters — the sky shivers behind it, the sand
// twitches at every jolt. So what the glass feels of the phone — which way
// is down, how hard it is pushed, how fast it turns, and how it stands in
// the world — eases toward each reading over a few hundredths of a second,
// the way a heavy thing in a hand takes up a motion rather than copying
// it. Short enough that a turn or a shake still reads as that, long enough
// that the tremor does not. The sand is told what they do to gravity, and how
// hard they swing (`swing`), which is what a desk's shake is made of.
// Pure and clock-free: `dt` is a parameter.

/** A rotation as a unit quaternion, x, y, z, w. */
export type Quat = [number, number, number, number];

export type View = {
  /** The glass's lag behind the phone, rad about x, y, z, and how fast
   *  that lag is changing. */
  lag: Vec3;
  lagRate: Vec3;
  /** The phone's spin at the last step, to take its change from. */
  spin: Vec3;
  /** The glass turned about its own axis by a finger, rad, and how fast. */
  orbit: number;
  orbitRate: number;
  /** How fast the orbit's rate changed, rad/s², eased: the desk's
   *  shake. */
  swing: number;
  /** What the glass feels of the phone (`follow`), eased toward each
   *  reading: gravity in the phone's frame, one g long; the phone's own
   *  acceleration, m/s²; how fast it turns, rad/s; and how it stands in
   *  the world (device to Earth), or null until the sensor has said. */
  down: Vec3;
  accel: Vec3;
  gyro: Vec3;
  turn: Quat | null;
};

/** The lag's spring (rad/s² a radian) and damper: a swing of about a
 *  second a cycle, damped enough that it goes a little past centre once
 *  and settles, rather than wobbling. */
const LAG_K = 45;
const LAG_C = 7.4;
/** How much of the phone's change of spin the glass feels: under one, so
 *  the lag stays a hint rather than a lurch. */
const LAG_KICK = 0.45;
/** The most the glass is left behind, rad: about ten degrees. */
const LAG_MAX = 0.18;

/** The orbit's spring back to facing the viewer, and its damper: slow and
 *  soft, so a spin runs on before it comes home. */
const ORBIT_K = 2.2;
const ORBIT_C = 2.4;

/** How long the follow takes to cover most of the way to a reading, s:
 *  gravity's slow lean, a push, a turn's rate, and the stance in the
 *  world the sky is turned by. */
const DOWN_TAU = 0.12;
const ACCEL_TAU = 0.05;
const GYRO_TAU = 0.08;
const TURN_TAU = 0.09;
/** How long the desk's shake takes up a change, s. */
const SWING_TAU = 0.05;

export function createView(): View {
  return {
    lag: [0, 0, 0],
    lagRate: [0, 0, 0],
    spin: [0, 0, 0],
    orbit: 0,
    orbitRate: 0,
    swing: 0,
    down: [0, -1, 0],
    accel: [0, 0, 0],
    gyro: [0, 0, 0],
    turn: null,
  };
}

/** How far toward a target a value eased over `tau` goes in `dt`. */
function ease(dt: number, tau: number): number {
  return dt <= 0 ? 0 : 1 - Math.exp(-dt / tau);
}

/** What the phone says this step, for `follow`. */
export type Felt = {
  down: Vec3;
  accel: Vec3;
  spin: Vec3;
  /** Device to Earth, row major (`deviceToEarth`), or null. */
  turn: number[] | null;
};

/**
 * Ease what the glass feels toward the phone's reading over `dt` seconds.
 * The first stance in the world is taken as it is — the glass does not
 * swing in from nowhere. Returns whether the glass is still catching up.
 */
export function follow(view: View, felt: Felt, dt: number): boolean {
  const kd = ease(dt, DOWN_TAU);
  const ka = ease(dt, ACCEL_TAU);
  const kg = ease(dt, GYRO_TAU);
  // Whether it is still catching up by more than the eye would see — or,
  // for the push and the spin, more than a sensor's own noise, which never
  // quite rests and would keep the glass drawing for nothing.
  let behind = false;
  for (let k = 0; k < 3; k++) {
    view.down[k] = view.down[k]! + (felt.down[k]! - view.down[k]!) * kd;
    view.accel[k] = view.accel[k]! + (felt.accel[k]! - view.accel[k]!) * ka;
    view.gyro[k] = view.gyro[k]! + (felt.spin[k]! - view.gyro[k]!) * kg;
    if (
      Math.abs(felt.down[k]! - view.down[k]!) > 1e-3 ||
      Math.abs(felt.accel[k]! - view.accel[k]!) > 0.2 ||
      Math.abs(felt.spin[k]! - view.gyro[k]!) > 0.02
    )
      behind = true;
  }
  const len = Math.hypot(...view.down) || 1;
  for (let k = 0; k < 3; k++) view.down[k] = view.down[k]! / len;
  if (felt.turn) {
    const to = quatOf(felt.turn);
    if (!view.turn) view.turn = to;
    else {
      view.turn = slerp(view.turn, to, ease(dt, TURN_TAU));
      // A tenth of a degree still to go is there.
      const dot = Math.min(1, Math.abs(dot4(view.turn, to)));
      if (2 * Math.acos(dot) > 2e-3) behind = true;
    }
  } else {
    view.turn = null;
  }
  return behind;
}

function dot4(a: Quat, b: Quat): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/** A rotation matrix (row major, 3×3) as a unit quaternion. */
export function quatOf(m: number[]): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** A unit quaternion as a rotation matrix, row major, 3×3. */
export function matOf(q: Quat): number[] {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
}

/** The rotation `t` of the way from `a` to `b`, the short way round. */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let d = dot4(a, b);
  const to: Quat = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : [...b];
  d = Math.abs(d);
  let wa: number;
  let wb: number;
  if (d > 0.9995) {
    wa = 1 - t;
    wb = t;
  } else {
    const th = Math.acos(d);
    const s = Math.sin(th);
    wa = Math.sin((1 - t) * th) / s;
    wb = Math.sin(t * th) / s;
  }
  const q: Quat = [
    a[0] * wa + to[0] * wb,
    a[1] * wa + to[1] * wb,
    a[2] * wa + to[2] * wb,
    a[3] * wa + to[3] * wb,
  ];
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/**
 * One step of `dt` seconds: the phone turning at `spin` (rad/s about its
 * axes), and — while a finger holds the glass — the orbit the finger has
 * put it at (`held`), otherwise null and the orbit runs free.
 */
export function stepView(
  view: View,
  spin: Vec3,
  dt: number,
  held: number | null,
): void {
  const h = Math.min(0.05, Math.max(0, dt));
  if (h === 0) return;
  for (let k = 0; k < 3; k++) {
    const change = spin[k]! - view.spin[k]!;
    let rate = view.lagRate[k]!;
    let lag = view.lag[k]!;
    rate += (-LAG_K * lag - LAG_C * rate) * h - LAG_KICK * change;
    lag += rate * h;
    if (lag > LAG_MAX) {
      lag = LAG_MAX;
      rate = Math.min(0, rate);
    } else if (lag < -LAG_MAX) {
      lag = -LAG_MAX;
      rate = Math.max(0, rate);
    }
    view.lag[k] = lag;
    view.lagRate[k] = rate;
    view.spin[k] = spin[k]!;
  }
  const before = view.orbitRate;
  if (held !== null) {
    view.orbitRate = (held - view.orbit) / h;
    view.orbit = held;
  } else {
    view.orbitRate += (-ORBIT_K * view.orbit - ORBIT_C * view.orbitRate) * h;
    view.orbit += view.orbitRate * h;
  }
  const swing = (view.orbitRate - before) / h;
  view.swing += (swing - view.swing) * ease(h, SWING_TAU);
}

/** Whether the view has come to rest. */
export function viewStill(view: View): boolean {
  const small = (v: number) => Math.abs(v) < 1e-4;
  return (
    view.lag.every(small) &&
    view.lagRate.every(small) &&
    small(view.orbit) &&
    small(view.orbitRate)
  );
}

/** A vector in the phone's frame into the glass's, the glass turned by the
 *  view: the lag's small rotation about x, y and z (taken in that order),
 *  then the orbit about the glass's own axis. */
export function intoGlass(view: View, v: Vec3): Vec3 {
  // The inverse of the glass's rotation: undo z, then y, then x, then the
  // orbit (which was applied first, inside).
  let [x, y, z] = v;
  const [ax, ay, az] = view.lag;
  let c = Math.cos(-az);
  let s = Math.sin(-az);
  [x, y] = [c * x - s * y, s * x + c * y];
  c = Math.cos(-ay);
  s = Math.sin(-ay);
  [x, z] = [c * x + s * z, -s * x + c * z];
  c = Math.cos(-ax);
  s = Math.sin(-ax);
  [y, z] = [c * y - s * z, s * y + c * z];
  c = Math.cos(-view.orbit);
  s = Math.sin(-view.orbit);
  [x, z] = [c * x + s * z, -s * x + c * z];
  return [x, y, z];
}
