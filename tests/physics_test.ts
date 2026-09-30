// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { bulbShape } from "../src/app/glass.ts";
import { GLASS, SAND } from "../src/app/look.ts";
import {
  airborne,
  buzzFor,
  frictionOf,
  moving,
  setGravity,
  step,
  turnOver,
  wallAt,
} from "../src/app/physics.ts";
import {
  capacity,
  createBulb,
  levelFill,
  pileFill,
  pour,
  settle,
  spokeAngle,
  volume,
  type Bulb,
} from "../src/app/sand.ts";

const shape = bulbShape(GLASS.teardrop, 0.41);
const REPOSE = SAND.quartz.repose;
const FRAME = 1 / 60;

/** Volume to within a fraction of a percent of the sand put in. */
const HAIR = 1e-3;

function bulb(rest: "waist" | "plate"): Bulb {
  return createBulb(shape, rest, REPOSE);
}

/** Everything in a bulb: the heap and the grains in the air. */
function total(b: Bulb): number {
  return volume(b) + airborne(b);
}

function run(b: Bulb, seconds: number, seed = 1): void {
  for (let t = 0; t < seconds; t += FRAME) step(b, FRAME, seed + t);
}

/** The steepest slope between two neighbouring cells of sand along any
 *  spoke, against gravity's lean. */
function steepest(b: Bulb): number {
  let worst = 0;
  const { n, m, height, floor, ceiling, lean, centre } = b;
  for (let a = 0; a < m; a++) {
    for (let i = 0; i < n - 1; i++) {
      const p = i * m + a;
      const q = (i + 1) * m + a;
      if (height[p]! - floor[i]! < 1e-9 || height[q]! - floor[i + 1]! < 1e-9)
        continue;
      if (
        ceiling[i]! - height[p]! < 1e-9 ||
        ceiling[i + 1]! - height[q]! < 1e-9
      )
        continue;
      const drop = height[p]! + lean[p]! - (height[q]! + lean[q]!);
      worst = Math.max(worst, Math.abs(drop) / (centre[i + 1]! - centre[i]!));
    }
  }
  return worst;
}

describe("the flowing layer", () => {
  it("keeps every grain while a heap slumps into a tilt", () => {
    const b = bulb("plate");
    const sand = capacity(b) * 0.4;
    pileFill(b, sand);
    setGravity(b, Math.sin(0.5), -Math.cos(0.5), 0);
    run(b, 3);
    expect(Math.abs(total(b) - sand) / sand).toBeLessThan(HAIR);
  });

  it("takes time to bring a heap down, and brings it to rest between its two angles", () => {
    const b = bulb("plate");
    const { still, moving: slide } = frictionOf(b);
    levelFill(b, capacity(b) * 0.1);
    // A heap dumped on the axis, far steeper than sand stands.
    pour(b, capacity(b) * 0.15);
    step(b, FRAME, 1);
    expect(steepest(b)).toBeGreaterThan(still);
    run(b, 5);
    expect(moving(b)).toBe(false);
    expect(steepest(b)).toBeLessThan(still * 1.03);
    // An avalanche runs on past the angle it started at.
    expect(steepest(b)).toBeGreaterThan(slide * 0.5);
  });

  it("leans a level heap into a tilt over a moment, not at once", () => {
    const b = bulb("plate");
    levelFill(b, capacity(b) * 0.35);
    const right = 0; // the spoke nearest +x
    const left = Math.round(b.m / 2);
    const at = (a: number) => b.height[(b.n - 8) * b.m + a]!;
    expect(Math.abs(spokeAngle(b, right))).toBeLessThan(0.2);
    // Fifty degrees: past the static angle, so the bed lets go. (Under it a
    // flat bed holds, as real sand does.)
    setGravity(b, Math.sin(0.87), -Math.cos(0.87), 0);
    step(b, FRAME, 1);
    const early = at(right) - at(left);
    run(b, 4);
    const late = at(right) - at(left);
    expect(late).toBeGreaterThan(0.02);
    expect(late).toBeGreaterThan(early * 2);
  });

  it("holds a flat bed tilted less than its static angle", () => {
    const b = bulb("plate");
    levelFill(b, capacity(b) * 0.35);
    const before = Float64Array.from(b.height);
    setGravity(b, Math.sin(0.5), -Math.cos(0.5), 0);
    run(b, 1);
    // A few grains at the edge, where the wall under the bed rises, settle
    // against it; the bed itself does not move.
    let mean = 0;
    for (let k = 0; k < before.length; k++)
      mean += Math.abs(before[k]! - b.height[k]!) / before.length;
    expect(mean).toBeLessThan(1e-4);
  });

  it("stands still once it has come to rest", () => {
    const b = bulb("plate");
    pileFill(b, capacity(b) * 0.3);
    settle(b);
    const before = Float64Array.from(b.height);
    run(b, 1);
    let most = 0;
    for (let k = 0; k < before.length; k++)
      most = Math.max(most, Math.abs(before[k]! - b.height[k]!));
    expect(most).toBeLessThan(1e-9);
    expect(moving(b)).toBe(false);
  });
});

describe("grains in the air", () => {
  it("turned over, a heap falls to the other end as a body and lands there, every grain of it", () => {
    const source = bulb("waist");
    const sink = bulb("plate");
    const sand = capacity(sink) * 0.4;
    pileFill(sink, sand);
    turnOver(source, sink);
    expect(volume(sink)).toBeLessThan(1e-12);
    expect(airborne(source)).toBeCloseTo(sand, 10);
    run(source, 0.05);
    expect(airborne(source)).toBeGreaterThan(sand * 0.5);
    run(source, 3);
    expect(source.air.count).toBe(0);
    expect(Math.abs(volume(source) - sand) / sand).toBeLessThan(HAIR);
    // The drop was felt, hard.
    expect(buzzFor(source.hits)).toBeGreaterThan(20);
  });

  it("stays inside the glass while it flies", () => {
    const source = bulb("waist");
    const sink = bulb("plate");
    pileFill(sink, capacity(sink) * 0.3);
    turnOver(source, sink);
    for (let t = 0; t < 1; t += FRAME) {
      step(source, FRAME, t);
      const air = source.air;
      for (let k = 0; k < air.count; k++) {
        const r = Math.hypot(air.x[k]!, air.z[k]!);
        expect(r).toBeLessThanOrEqual(wallAt(source, air.y[k]!) + 1e-9);
        expect(air.y[k]!).toBeLessThanOrEqual(shape.height + 1e-9);
      }
    }
  });

  it("is thrown up when the glass is jerked faster than a fall, and comes back down", () => {
    const b = bulb("plate");
    const sand = capacity(b) * 0.35;
    pileFill(b, sand);
    setGravity(b, 0, 1.2, 0);
    run(b, 0.1);
    expect(airborne(b)).toBeGreaterThan(0);
    setGravity(b, 0, -1, 0);
    run(b, 3);
    expect(b.air.count).toBe(0);
    expect(Math.abs(volume(b) - sand) / sand).toBeLessThan(HAIR);
  });

  it("throws once a stroke, not once a frame", () => {
    const b = bulb("plate");
    pileFill(b, capacity(b) * 0.35);
    setGravity(b, 0, 0.5, 0);
    step(b, FRAME, 1);
    const once = airborne(b);
    step(b, FRAME, 2);
    expect(airborne(b)).toBeCloseTo(once, 12);
  });
});

describe("the buzz", () => {
  it("is nothing for a stray grain and grows with the hit, to a limit", () => {
    expect(buzzFor(0)).toBe(0);
    expect(buzzFor(0.005)).toBe(0);
    expect(buzzFor(0.02)).toBeGreaterThan(0);
    expect(buzzFor(1)).toBeGreaterThan(buzzFor(0.05));
    expect(buzzFor(1e6)).toBe(40);
  });
});
