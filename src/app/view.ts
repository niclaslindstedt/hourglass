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
// screen, z out of it). The sand is told what they do to gravity, and how
// hard they swing (`swing`), which is what a desk's shake is made of.
// Pure and clock-free: `dt` is a parameter.

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
  /** How fast the orbit's rate changed at the last step, rad/s²: the
   *  desk's shake. */
  swing: number;
};

/** The lag's spring (rad/s² a radian) and damper: a swing of about a
 *  second and a half a cycle, settled in two. */
const LAG_K = 60;
const LAG_C = 5.2;
/** How much of the phone's change of spin the glass feels: under one, so
 *  the lag stays a hint rather than a lurch. */
const LAG_KICK = 0.45;
/** The most the glass is left behind, rad: about ten degrees. */
const LAG_MAX = 0.18;

/** The orbit's spring back to facing the viewer, and its damper: slow and
 *  soft, so a spin runs on before it comes home. */
const ORBIT_K = 2.2;
const ORBIT_C = 2.4;

export function createView(): View {
  return {
    lag: [0, 0, 0],
    lagRate: [0, 0, 0],
    spin: [0, 0, 0],
    orbit: 0,
    orbitRate: 0,
    swing: 0,
  };
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
  view.swing = (view.orbitRate - before) / h;
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
