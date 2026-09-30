// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { bulbShape } from "../src/app/glass.ts";
import { GLASS, GLASSES, SAND } from "../src/app/look.ts";
import {
  capacity,
  cellAt,
  createBulb,
  drain,
  funnelFill,
  jolt,
  levelApex,
  levelFill,
  pileFill,
  pour,
  relax,
  rim,
  rimAt,
  setTilt,
  settle,
  spokeAngle,
  volume,
} from "../src/app/sand.ts";

const shape = bulbShape(GLASS.teardrop, 0.41);
const REPOSE = SAND.quartz.repose;
const TAN = Math.tan((REPOSE * Math.PI) / 180);
/** The angle is reached by relaxing ring against ring, so a settled heap
 *  stands within a hair of it rather than on it: two per cent. */
const HAIR = TAN * 0.02;

/** The steepest slope the sand stands at between two neighbouring cells
 *  along any spoke, read against gravity's lean, as a tangent. Between two
 *  cells of sand, either way; between sand and an empty cell, only
 *  downhill into the empty one — the other way is the glass wall rising
 *  beside the heap, which is not a slope of sand. */
function steepest(bulb: ReturnType<typeof createBulb>): number {
  let worst = 0;
  const { n, m, height, floor, ceiling, lean, centre } = bulb;
  for (let a = 0; a < m; a++) {
    for (let i = 0; i < n - 1; i++) {
      const p = i * m + a;
      const q = (i + 1) * m + a;
      const has = height[p]! - floor[i]! > 1e-9;
      const next = height[q]! - floor[i + 1]! > 1e-9;
      if (!has && !next) continue;
      // A cell full to the wall over it is sand pressed against the glass,
      // not a slope of sand.
      if (
        ceiling[i]! - height[p]! < 1e-9 ||
        ceiling[i + 1]! - height[q]! < 1e-9
      )
        continue;
      const dr = centre[i + 1]! - centre[i]!;
      const drop = height[p]! + lean[p]! - (height[q]! + lean[q]!);
      if (has && next) worst = Math.max(worst, Math.abs(drop) / dr);
      else if (has && drop > 0) worst = Math.max(worst, drop / dr);
      else if (next && -drop > 0) worst = Math.max(worst, -drop / dr);
    }
  }
  return worst;
}

/** The sand's height in a ring, on its first spoke — the rings are alike
 *  round a glass standing straight. */
function ring(bulb: ReturnType<typeof createBulb>, i: number): number {
  return bulb.height[i * bulb.m]!;
}

/** The sand's height on the spoke nearest an angle, at a ring. */
function heightAt(
  bulb: ReturnType<typeof createBulb>,
  ring: number,
  angle: number,
): number {
  let best = 0;
  let gap = Infinity;
  for (let a = 0; a < bulb.m; a++) {
    const d = Math.abs(
      Math.atan2(
        Math.sin(spokeAngle(bulb, a) - angle),
        Math.cos(spokeAngle(bulb, a) - angle),
      ),
    );
    if (d < gap) {
      gap = d;
      best = a;
    }
  }
  return bulb.height[ring * bulb.m + best]!;
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
    expect(ring(bottom, 0)!).toBeGreaterThan(ring(bottom, r)! + 0.02);
  });

  it("drains a funnel down to the hole and slides the walls in after it", () => {
    const top = createBulb(shape, "waist", REPOSE);
    const full = capacity(top) * 0.45;
    levelFill(top, full);
    const before = ring(top, 0)!;
    // A tenth through the hole, relaxed: the middle has dropped and the
    // surface is a funnel no steeper than the sand holds.
    drain(top, full * 0.1);
    relax(top, 200);
    expect(ring(top, 0)!).toBeLessThan(before);
    expect(ring(top, 0)!).toBeLessThan(ring(top, rim(top))!);
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
          expect(ring(bulb, i)!).toBeGreaterThanOrEqual(bulb.floor[i]! - 1e-9);
          expect(ring(bulb, i)!).toBeLessThanOrEqual(bulb.ceiling[i]! + 1e-9);
        }
      }
    }
  });

  it("holds a level fill flat, and a funnel fill lower in the middle", () => {
    const top = createBulb(shape, "waist", REPOSE);
    const full = capacity(top) * 0.45;
    levelFill(top, full);
    expect(volume(top)).toBeCloseTo(full, 9);
    const level = ring(top, 0)!;
    for (let i = 0; i <= rim(top); i++) {
      expect(ring(top, i)!).toBeCloseTo(level, 9);
    }
    funnelFill(top, full, full * 0.5);
    expect(volume(top)).toBeCloseTo(full * 0.5, 6);
    expect(ring(top, 0)!).toBeLessThan(ring(top, rim(top))!);
  });

  it("is quiet once settled: another sweep moves nothing", () => {
    const bottom = createBulb(shape, "plate", SAND.blue.repose);
    pileFill(bottom, capacity(bottom) * 0.3);
    expect(relax(bottom, 4)).toBeLessThan(1e-7);
  });
});

describe("a tilted glass", () => {
  it("leans its level fill towards the side gravity leans to, and holds every grain", () => {
    const bulb = createBulb(shape, "plate", REPOSE);
    const amount = capacity(bulb) * 0.3;
    setTilt(bulb, Math.tan((30 * Math.PI) / 180), 0);
    levelFill(bulb, amount);
    expect(volume(bulb)).toBeCloseTo(amount, 9);
    // In the bulb's own frame the surface stands higher on the +x side —
    // the side the glass leans down towards — and the difference across a
    // diameter is the tangent times the distance.
    const ring = 12;
    const right = heightAt(bulb, ring, 0);
    const left = heightAt(bulb, ring, Math.PI);
    const dx = 2 * bulb.centre[ring]! * Math.cos(spokeAngle(bulb, 0));
    expect(right - left).toBeCloseTo(Math.tan((30 * Math.PI) / 180) * dx, 6);
    // Read against gravity, it is level.
    expect(steepest(bulb)).toBeLessThan(1e-6);
  });

  it("settles a pile to the angle of repose read against gravity, not the axis", () => {
    const bulb = createBulb(shape, "plate", REPOSE);
    setTilt(bulb, Math.tan((20 * Math.PI) / 180), 0);
    pileFill(bulb, capacity(bulb) * 0.25);
    expect(steepest(bulb)).toBeLessThanOrEqual(TAN + HAIR);
    // The heap has gone with the lean: more sand on the low side.
    let right = 0;
    let left = 0;
    for (let i = 0; i < bulb.n; i++) {
      right += heightAt(bulb, i, 0) - bulb.floor[i]!;
      left += heightAt(bulb, i, Math.PI) - bulb.floor[i]!;
    }
    expect(right).toBeGreaterThan(left);
  });

  it("levels the apex against a steep lean without losing or making sand", () => {
    const bulb = createBulb(shape, "waist", REPOSE);
    // Seventy degrees, and a thin skin of sand over the hole: the apex's
    // spokes are pressed against the floor on the high side, where an
    // average would put them below it.
    setTilt(bulb, Math.tan((70 * Math.PI) / 180), 0);
    for (let a = 0; a < bulb.m; a++) bulb.height[a] = bulb.floor[0]! + 0.002;
    const before = volume(bulb);
    levelApex(bulb);
    expect(Math.abs(volume(bulb) - before) / before).toBeLessThan(1e-9);
    for (let a = 0; a < bulb.m; a++) {
      expect(bulb.height[a]!).toBeGreaterThanOrEqual(bulb.floor[0]!);
      expect(bulb.height[a]!).toBeLessThanOrEqual(bulb.ceiling[0]!);
    }
  });

  it("lands a slanting stream where it falls, and the heap grows there", () => {
    const bulb = createBulb(shape, "plate", REPOSE);
    const x = shape.radius * 0.5;
    const [i, a] = cellAt(bulb, x, 0);
    expect(i).toBeGreaterThan(0);
    const before = volume(bulb);
    const back = pour(bulb, capacity(bulb) * 0.01, x, 0);
    expect(back).toBe(0);
    expect(volume(bulb) - before).toBeCloseTo(capacity(bulb) * 0.01, 9);
    expect(bulb.height[i * bulb.m + a]! - bulb.floor[i]!).toBeGreaterThan(0);
    // Nothing landed on the axis or across from it.
    expect(bulb.height[0]! - bulb.floor[0]!).toBe(0);
    expect(rimAt(bulb, (a + bulb.m / 2) % bulb.m)).toBe(-1);
  });
});

describe("a shaken glass", () => {
  it("throws grains about and keeps every one of them", () => {
    const bulb = createBulb(shape, "plate", REPOSE);
    const amount = capacity(bulb) * 0.3;
    pileFill(bulb, amount);
    const moved = jolt(bulb, 0.8, 7);
    expect(moved).toBeGreaterThan(0);
    expect(volume(bulb)).toBeCloseTo(amount, 9);
    for (let i = 0; i < bulb.n; i++) {
      for (let a = 0; a < bulb.m; a++) {
        const h = bulb.height[i * bulb.m + a]!;
        expect(h).toBeGreaterThanOrEqual(bulb.floor[i]! - 1e-9);
        expect(h).toBeLessThanOrEqual(bulb.ceiling[i]! + 1e-9);
      }
    }
    // And once the shaking stops, it settles back to its angle.
    settle(bulb);
    expect(steepest(bulb)).toBeLessThanOrEqual(TAN + HAIR);
  });

  it("slumps flatter while it is shaken, and no flatter than it gives", () => {
    const bulb = createBulb(shape, "plate", REPOSE);
    pileFill(bulb, capacity(bulb) * 0.3);
    const rest = steepest(bulb);
    bulb.give = 1;
    settle(bulb);
    const shaken = steepest(bulb);
    expect(shaken).toBeLessThan(rest * 0.6);
    expect(shaken).toBeGreaterThan(rest * 0.3);
    expect(jolt(bulb, 0, 1)).toBe(0);
  });
});
