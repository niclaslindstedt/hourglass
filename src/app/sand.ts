// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { BulbShape } from "./glass.ts";

// The sand, as a heap: what shape it takes in a bulb, and how it moves.
//
// A bulb is round, and the sand in it is very nearly so — a funnel above the
// hole, a cone under the stream — so the heap is kept as rings: the surface
// height at each radius out from the axis, and the volume of every ring is
// its area times the sand standing in it. That is what makes the model
// exact in three dimensions rather than a picture of a slice: draining a
// tenth of the volume drains a tenth of the sand, wherever it stands.
//
// Two rules move it. Sand leaves through the hole and lands on the axis
// (`drain`, `pour`); and wherever the surface is steeper than the sand's
// angle of repose, sand slides down until it is not (`relax`). Everything
// the eye reads as an hourglass — the funnel deepening, the cone spreading,
// the last of the top sliding in from the walls — is those two rules. Pure,
// clock-free, and without a random number in it.

/** Which end of the bulb gravity pulls the sand towards: the waist, in the
 *  top bulb, or the plate, in the bottom one. Heights in a bulb are measured
 *  from that end. */
export type Rest = "waist" | "plate";

export type Bulb = {
  /** The end the sand rests against. */
  rest: Rest;
  /** How many rings the heap is kept in. */
  n: number;
  /** The rings' centre radii and areas. */
  centre: Float64Array;
  area: Float64Array;
  /** The wall under the sand, and the wall over it, at each ring's centre:
   *  heights from the resting end. */
  floor: Float64Array;
  ceiling: Float64Array;
  /** The surface: the height the sand stands to at each ring, `floor` where
   *  there is none. */
  height: Float64Array;
  /** The slope the sand holds, as a tangent. */
  slope: number;
};

/** How many rings a bulb is kept in. */
export const RINGS = 32;

/** Below this much sand a ring counts as empty. */
const EPSILON = 1e-9;

/** A bulb with no sand in it. */
export function createBulb(
  shape: BulbShape,
  rest: Rest,
  reposeDegrees: number,
  n = RINGS,
): Bulb {
  const centre = new Float64Array(n);
  const area = new Float64Array(n);
  const floor = new Float64Array(n);
  const ceiling = new Float64Array(n);
  const dr = shape.radius / n;
  for (let i = 0; i < n; i++) {
    const inner = i * dr;
    const outer = inner + dr;
    centre[i] = (inner + outer) / 2;
    area[i] = Math.PI * (outer * outer - inner * inner);
    // The two walls, read at the ring's centre. Resting against the waist
    // the floor is the taper and the ceiling the dome; against the plate it
    // is the other way up, and the heights count from the plate.
    const taper = shape.taper(centre[i]!);
    const dome = shape.dome(centre[i]!);
    if (rest === "waist") {
      floor[i] = taper;
      ceiling[i] = dome;
    } else {
      floor[i] = shape.height - dome;
      ceiling[i] = shape.height - taper;
    }
  }
  return {
    rest,
    n,
    centre,
    area,
    floor,
    ceiling,
    height: Float64Array.from(floor),
    slope: Math.tan((reposeDegrees * Math.PI) / 180),
  };
}

/** How much sand the bulb could hold. */
export function capacity(bulb: Bulb): number {
  let v = 0;
  for (let i = 0; i < bulb.n; i++) {
    v += bulb.area[i]! * (bulb.ceiling[i]! - bulb.floor[i]!);
  }
  return v;
}

/** How much sand is in it. */
export function volume(bulb: Bulb): number {
  let v = 0;
  for (let i = 0; i < bulb.n; i++) {
    v += bulb.area[i]! * (bulb.height[i]! - bulb.floor[i]!);
  }
  return v;
}

/** The outermost ring with sand in it, or −1. */
export function rim(bulb: Bulb): number {
  for (let i = bulb.n - 1; i >= 0; i--) {
    if (bulb.height[i]! - bulb.floor[i]! > EPSILON) return i;
  }
  return -1;
}

/** Empty the bulb. */
export function clear(bulb: Bulb): void {
  bulb.height.set(bulb.floor);
}

/**
 * Add sand at the axis, where the stream lands. A ring that is full to the
 * wall over it passes the rest outward. Returns what could not be placed —
 * only ever when the bulb is full.
 */
export function pour(bulb: Bulb, amount: number): number {
  let left = amount;
  for (let i = 0; i < bulb.n && left > EPSILON; i++) {
    const room = (bulb.ceiling[i]! - bulb.height[i]!) * bulb.area[i]!;
    const take = Math.min(room, left);
    if (take <= 0) continue;
    bulb.height[i] = bulb.height[i]! + take / bulb.area[i]!;
    left -= take;
  }
  return left;
}

/**
 * Take sand out through the hole at the axis. The innermost sand goes
 * first; relaxing afterwards is what brings the rest down to it. Returns
 * what was taken — less than asked only when the bulb has run out.
 */
export function drain(bulb: Bulb, amount: number): number {
  let left = amount;
  for (let i = 0; i < bulb.n && left > EPSILON; i++) {
    const have = (bulb.height[i]! - bulb.floor[i]!) * bulb.area[i]!;
    const take = Math.min(have, left);
    if (take <= 0) continue;
    bulb.height[i] = bulb.height[i]! - take / bulb.area[i]!;
    left -= take;
  }
  return amount - left;
}

/**
 * One pass of the angle of repose over the surface, inward and outward:
 * between every two neighbouring rings, if the surface drops more steeply
 * than the sand holds, enough slides down the slope to bring it back to that
 * angle — never more than the higher ring has, never more than the lower
 * ring has room for under its wall. Returns how much sand moved.
 */
export function relax(bulb: Bulb, sweeps = 1): number {
  let moved = 0;
  const { n, centre, area, floor, ceiling, height, slope } = bulb;
  for (let s = 0; s < sweeps; s++) {
    // Alternate the direction, so a long slope settles from both ends
    // rather than marching one way.
    const forward = s % 2 === 0;
    for (let k = 0; k < n - 1; k++) {
      const i = forward ? k : n - 2 - k;
      const j = i + 1;
      const dr = centre[j]! - centre[i]!;
      const max = slope * dr;
      const diff = height[i]! - height[j]!;
      let from: number;
      let to: number;
      let over: number;
      if (diff > max) {
        from = i;
        to = j;
        over = diff - max;
      } else if (-diff > max) {
        from = j;
        to = i;
        over = -diff - max;
      } else {
        continue;
      }
      // The volume that brings the difference back to the slope, given that
      // a ring's height moves by volume over area on both sides.
      let dv = over / (1 / area[from]! + 1 / area[to]!);
      dv = Math.min(dv, (height[from]! - floor[from]!) * area[from]!);
      dv = Math.min(dv, (ceiling[to]! - height[to]!) * area[to]!);
      if (dv <= EPSILON) continue;
      height[from] = height[from]! - dv / area[from]!;
      height[to] = height[to]! + dv / area[to]!;
      moved += dv;
    }
  }
  return moved;
}

/** Below this much movement in a pair of sweeps the heap counts as still. */
const STILL = 1e-10;

/** Relax until nothing moves any more (or the sweeps run out). */
export function settle(bulb: Bulb, maxSweeps = 3000): void {
  for (let s = 0; s < maxSweeps; s += 2) {
    if (relax(bulb, 2) < STILL) return;
  }
}

/**
 * The heap as a level fill: a flat surface holding `amount`, found by
 * bisection on the level. What sand looks like right after the glass has
 * been turned and the whole heap has dropped onto the other end.
 */
export function levelFill(bulb: Bulb, amount: number): void {
  clear(bulb);
  const held = (level: number) => {
    let v = 0;
    for (let i = 0; i < bulb.n; i++) {
      const top = Math.min(level, bulb.ceiling[i]!);
      if (top > bulb.floor[i]!) v += bulb.area[i]! * (top - bulb.floor[i]!);
    }
    return v;
  };
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < bulb.n; i++) hi = Math.max(hi, bulb.ceiling[i]!);
  if (amount >= held(hi)) {
    bulb.height.set(bulb.ceiling);
    return;
  }
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (held(mid) < amount) lo = mid;
    else hi = mid;
  }
  const level = (lo + hi) / 2;
  for (let i = 0; i < bulb.n; i++) {
    bulb.height[i] = Math.max(
      bulb.floor[i]!,
      Math.min(level, bulb.ceiling[i]!),
    );
  }
}

/** The heap as a cone: `amount` poured in at the axis and left to settle,
 *  which is what the bottom bulb holds after the stream has been running. */
export function pileFill(bulb: Bulb, amount: number, steps = 40): void {
  clear(bulb);
  for (let k = 0; k < steps; k++) {
    pour(bulb, amount / steps);
    relax(bulb, 8);
  }
  settle(bulb);
}

/** The heap as a funnel: a level fill of `full` drained down to `amount`
 *  through the hole, a little at a time, which is what the top bulb holds
 *  part way through a run. */
export function funnelFill(
  bulb: Bulb,
  full: number,
  amount: number,
  steps = 60,
): void {
  levelFill(bulb, full);
  const out = Math.max(0, full - amount);
  for (let k = 0; k < steps; k++) {
    drain(bulb, out / steps);
    relax(bulb, 8);
  }
  settle(bulb);
}
