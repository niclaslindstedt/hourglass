// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { bulbShape } from "../src/app/glass.ts";
import { GLASS, GLASSES, SAND } from "../src/app/look.ts";
import {
  capacity,
  createBulb,
  drain,
  funnelFill,
  levelFill,
  pileFill,
  pour,
  relax,
  rim,
  settle,
  volume,
} from "../src/app/sand.ts";

const shape = bulbShape(GLASS.teardrop, 0.41);
const REPOSE = SAND.quartz.repose;
const TAN = Math.tan((REPOSE * Math.PI) / 180);
/** The angle is reached by relaxing ring against ring, so a settled heap
 *  stands within a hair of it rather than on it: two per cent. */
const HAIR = TAN * 0.02;

/** The steepest slope the sand stands at between two neighbouring rings,
 *  as a tangent. Between two rings of sand, either way; between sand and
 *  an empty ring, only downhill into the empty one — the other way is the
 *  glass wall rising beside the heap, which is not a slope of sand. */
function steepest(bulb: ReturnType<typeof createBulb>): number {
  let worst = 0;
  for (let i = 0; i < bulb.n - 1; i++) {
    const a = bulb.height[i]! - bulb.floor[i]! > 1e-9;
    const b = bulb.height[i + 1]! - bulb.floor[i + 1]! > 1e-9;
    if (!a && !b) continue;
    const dr = bulb.centre[i + 1]! - bulb.centre[i]!;
    const drop = bulb.height[i]! - bulb.height[i + 1]!;
    if (a && b) worst = Math.max(worst, Math.abs(drop) / dr);
    else if (a && drop > 0) worst = Math.max(worst, drop / dr);
    else if (b && -drop > 0) worst = Math.max(worst, -drop / dr);
  }
  return worst;
}

describe("a bulb of sand", () => {
  it("starts empty and holds what the glass has room for", () => {
    const top = createBulb(shape, "waist", REPOSE);
    const bottom = createBulb(shape, "plate", REPOSE);
    expect(volume(top)).toBe(0);
    expect(rim(top)).toBe(-1);
    // Both bulbs are the same glass, so they hold the same.
    expect(capacity(top)).toBeCloseTo(capacity(bottom), 9);
    // …and about what a solid of that profile encloses: a rough cylinder
    // check, since the exact figure is the integral the rings compute.
    const cylinder = Math.PI * shape.radius ** 2 * shape.height;
    expect(capacity(top)).toBeGreaterThan(cylinder * 0.4);
    expect(capacity(top)).toBeLessThan(cylinder);
  });

  it("keeps every grain: pouring adds exactly what was poured, draining takes exactly what was drained", () => {
    const bottom = createBulb(shape, "plate", REPOSE);
    const v = capacity(bottom) * 0.45;
    expect(pour(bottom, v)).toBe(0);
    expect(volume(bottom)).toBeCloseTo(v, 9);
    settle(bottom);
    expect(volume(bottom)).toBeCloseTo(v, 9);
    expect(drain(bottom, v * 0.3)).toBeCloseTo(v * 0.3, 9);
    expect(volume(bottom)).toBeCloseTo(v * 0.7, 9);
    // More than there is comes back as what there was.
    expect(drain(bottom, v)).toBeCloseTo(v * 0.7, 9);
    expect(volume(bottom)).toBeCloseTo(0, 9);
  });

  it("settles to the sand's angle of repose and no steeper", () => {
    const bottom = createBulb(shape, "plate", REPOSE);
    pileFill(bottom, capacity(bottom) * 0.45);
    expect(steepest(bottom)).toBeLessThanOrEqual(TAN + HAIR);
    // A cone, not a puddle: the middle stands well above the rim.
    const r = rim(bottom);
    expect(r).toBeGreaterThan(4);
    expect(bottom.height[0]!).toBeGreaterThan(bottom.height[r]! + 0.02);
  });

  it("drains a funnel down to the hole and slides the walls in after it", () => {
    const top = createBulb(shape, "waist", REPOSE);
    const full = capacity(top) * 0.45;
    levelFill(top, full);
    const before = top.height[0]!;
    // A tenth through the hole, relaxed: the middle has dropped and the
    // surface is a funnel no steeper than the sand holds.
    drain(top, full * 0.1);
    relax(top, 200);
    expect(top.height[0]!).toBeLessThan(before);
    expect(top.height[0]!).toBeLessThan(top.height[rim(top)]!);
    expect(steepest(top)).toBeLessThanOrEqual(TAN + HAIR);
    // All of it, in steps: the bulb ends empty, whatever was on the walls.
    for (let k = 0; k < 200; k++) {
      drain(top, full * 0.005);
      relax(top, 8);
    }
    settle(top);
    expect(volume(top)).toBeLessThan(full * 0.001);
  });

  it("never lets sand stand above the wall over it or below the wall under it", () => {
    for (const id of GLASSES) {
      const s = bulbShape(GLASS[id], 0.4);
      for (const rest of ["waist", "plate"] as const) {
        const bulb = createBulb(s, rest, REPOSE);
        pileFill(bulb, capacity(bulb) * 0.6);
        for (let i = 0; i < bulb.n; i++) {
          expect(bulb.height[i]!).toBeGreaterThanOrEqual(bulb.floor[i]! - 1e-9);
          expect(bulb.height[i]!).toBeLessThanOrEqual(bulb.ceiling[i]! + 1e-9);
        }
      }
    }
  });

  it("holds a level fill flat, and a funnel fill lower in the middle", () => {
    const top = createBulb(shape, "waist", REPOSE);
    const full = capacity(top) * 0.45;
    levelFill(top, full);
    expect(volume(top)).toBeCloseTo(full, 9);
    const level = top.height[0]!;
    for (let i = 0; i <= rim(top); i++) {
      expect(top.height[i]!).toBeCloseTo(level, 9);
    }
    funnelFill(top, full, full * 0.5);
    expect(volume(top)).toBeCloseTo(full * 0.5, 6);
    expect(top.height[0]!).toBeLessThan(top.height[rim(top)]!);
  });

  it("is quiet once settled: another sweep moves nothing", () => {
    const bottom = createBulb(shape, "plate", SAND.blue.repose);
    pileFill(bottom, capacity(bottom) * 0.3);
    expect(relax(bottom, 4)).toBeLessThan(1e-7);
  });
});
