// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { bulbShape } from "../src/app/glass.ts";
import { GLASS, SAND } from "../src/app/look.ts";
import { wallAt } from "../src/app/physics.ts";
import { capacity, createBulb, funnelFill, pileFill } from "../src/app/sand.ts";
import {
  rimHeights,
  surfaceIndex,
  surfaceInto,
  surfaceVertexCount,
} from "../src/app/sandMesh.ts";

const shape = bulbShape(GLASS.teardrop, 0.41);

describe("the heap as a mesh", () => {
  it("indexes every vertex of its grid and nothing past it", () => {
    const n = 32;
    const m = 24;
    const count = surfaceVertexCount(n, m);
    const index = surfaceIndex(n, m);
    expect(index.length % 3).toBe(0);
    const used = new Set(index);
    expect(Math.max(...index)).toBe(count - 1);
    expect(used.size).toBe(count);
  });

  it("stands on the sand, inside the glass, and marks bare glass as bare", () => {
    const bulb = createBulb(shape, "waist", SAND.quartz.repose);
    const count = surfaceVertexCount(bulb.n, bulb.m);
    const positions = new Float32Array(count * 3);
    const presence = new Float32Array(count);
    // Empty: every vertex is bare glass, drawn as nothing.
    surfaceInto(bulb, positions, presence);
    expect([...presence].every((p) => p === 0)).toBe(true);
    // Most of the way run through: a funnel down to the hole.
    const sand = capacity(bulb) * 0.45;
    funnelFill(bulb, sand, sand * 0.2);
    surfaceInto(bulb, positions, presence);
    let bare = 0;
    for (let k = 0; k < count; k++) {
      const x = positions[k * 3]!;
      const y = positions[k * 3 + 1]!;
      const z = positions[k * 3 + 2]!;
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(shape.height + 1e-6);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(wallAt(bulb, y) * 1.05);
      if (presence[k] === 0) bare++;
    }
    expect(bare).toBeLessThan(count);
  });

  it("cuts the skin where the heap meets the glass, and nowhere on an empty bulb", () => {
    const bulb = createBulb(shape, "plate", SAND.quartz.repose);
    const rims = new Float32Array(bulb.m);
    rimHeights(bulb, rims);
    expect([...rims].every((h) => h === -1)).toBe(true);
    pileFill(bulb, capacity(bulb) * 0.3);
    rimHeights(bulb, rims);
    for (const h of rims) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(shape.height);
    }
  });
});
