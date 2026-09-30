// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { deviceToEarth, type Vec3 } from "../src/app/useMotion.ts";
import {
  createView,
  follow,
  intoGlass,
  matOf,
  quatOf,
  stepView,
  viewStill,
} from "../src/app/view.ts";

const FRAME = 1 / 60;

describe("the glass in the hand", () => {
  it("lags a quick turn of the phone, swings back, and settles head on", () => {
    const view = createView();
    // A quarter of a second turning at two radians a second about y.
    for (let t = 0; t < 0.25; t += FRAME)
      stepView(view, [0, 2, 0], FRAME, null);
    // Left behind: turned the other way from the phone.
    expect(view.lag[1]).toBeLessThan(-0.01);
    expect(Math.abs(view.lag[1])).toBeLessThanOrEqual(0.18);
    let most = 0;
    for (let t = 0; t < 4; t += FRAME) {
      stepView(view, [0, 0, 0], FRAME, null);
      most = Math.max(most, view.lag[1]);
    }
    // It swung past centre after the stop, and came to rest.
    expect(most).toBeGreaterThan(0);
    expect(viewStill(view)).toBe(true);
  });

  it("does not move for a phone held still", () => {
    const view = createView();
    for (let t = 0; t < 1; t += FRAME) stepView(view, [0, 0, 0], FRAME, null);
    expect(viewStill(view)).toBe(true);
  });

  it("spins on after a flick and eases back to face the viewer", () => {
    const view = createView();
    // Dragged to half a turn over a tenth of a second, then let go.
    for (let k = 1; k <= 6; k++)
      stepView(view, [0, 0, 0], FRAME, (k / 6) * 0.5);
    expect(view.orbitRate).toBeGreaterThan(1);
    stepView(view, [0, 0, 0], FRAME, null);
    expect(view.orbit).toBeGreaterThan(0.5);
    for (let t = 0; t < 8; t += FRAME) stepView(view, [0, 0, 0], FRAME, null);
    expect(Math.abs(view.orbit)).toBeLessThan(1e-3);
  });

  it("turns gravity into the glass's frame the other way from the glass", () => {
    const view = createView();
    view.orbit = Math.PI / 2;
    // The glass turned a quarter about its axis: what was to the phone's
    // right is toward the glass's front, or back.
    const g = intoGlass(view, [1, 0, 0]);
    expect(Math.abs(g[0])).toBeLessThan(1e-9);
    expect(Math.abs(g[2])).toBeCloseTo(1, 9);
    view.orbit = 0;
    view.lag = [0, 0, 0.1];
    const d = intoGlass(view, [0, -1, 0]);
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
    // Rolled with the phone left behind: gravity leans across the glass.
    expect(Math.abs(d[0])).toBeGreaterThan(0.05);
  });
});

describe("the glass follows the phone, eased", () => {
  const still = { down: [0, -1, 0] as Vec3, accel: [0, 0, 0] as Vec3 };

  it("takes a rotation to a quaternion and back", () => {
    for (const [a, b, g] of [
      [0, 90, 0],
      [30, 60, -20],
      [200, -90, 10],
      [310, 170, 80],
    ] as const) {
      const m = deviceToEarth(a, b, g);
      const back = matOf(quatOf(m));
      for (let k = 0; k < 9; k++) expect(back[k]).toBeCloseTo(m[k]!, 9);
    }
  });

  it("stands the way the phone first stands, without swinging in", () => {
    const view = createView();
    const m = deviceToEarth(40, 80, 10);
    follow(view, { ...still, spin: [0, 0, 0], turn: m }, FRAME);
    const now = matOf(view.turn!);
    for (let k = 0; k < 9; k++) expect(now[k]).toBeCloseTo(m[k]!, 9);
  });

  it("takes up a turn of the phone over a tenth of a second or so", () => {
    const view = createView();
    const from = deviceToEarth(0, 90, 0);
    const to = deviceToEarth(30, 90, 0);
    follow(view, { ...still, spin: [0, 0, 0], turn: from }, FRAME);
    // One frame on, the glass has gone only part of the way.
    expect(follow(view, { ...still, spin: [0, 0, 0], turn: to }, FRAME)).toBe(
      true,
    );
    const part = matOf(view.turn!);
    // Row 1, column 0 is the sine of the turn: 0 from, a half to.
    expect(part[3]).toBeGreaterThan(from[3]! + 0.01);
    expect(part[3]).toBeLessThan(to[3]! - 0.2);
    // A second on, it is there, and says so.
    let catching = true;
    for (let t = 0; t < 1; t += FRAME)
      catching = follow(view, { ...still, spin: [0, 0, 0], turn: to }, FRAME);
    expect(catching).toBe(false);
    const there = matOf(view.turn!);
    for (let k = 0; k < 9; k++) expect(there[k]).toBeCloseTo(to[k]!, 3);
  });

  it("smooths a tremor out of the push and keeps a real jolt", () => {
    const view = createView();
    // A hand's tremor: a push of 1.5 m/s² flipping sign every frame.
    let most = 0;
    for (let k = 0; k < 60; k++) {
      const a = k % 2 ? 1.5 : -1.5;
      follow(
        view,
        { ...still, accel: [a, 0, 0], spin: [0, 0, 0], turn: null },
        FRAME,
      );
      most = Math.max(most, Math.abs(view.accel[0]));
    }
    expect(most).toBeLessThan(0.5);
    // A jolt held a tenth of a second comes through most of the way.
    const jolt = createView();
    for (let t = 0; t < 0.1; t += FRAME)
      follow(
        jolt,
        { ...still, accel: [0, 20, 0], spin: [0, 0, 0], turn: null },
        FRAME,
      );
    expect(jolt.accel[1]).toBeGreaterThan(14);
  });

  it("keeps gravity one g long as it eases round", () => {
    const view = createView();
    for (let t = 0; t < 0.2; t += FRAME) {
      follow(
        view,
        { down: [1, 0, 0], accel: [0, 0, 0], spin: [0, 0, 0], turn: null },
        FRAME,
      );
      expect(Math.hypot(...view.down)).toBeCloseTo(1, 9);
    }
    expect(view.down[0]).toBeGreaterThan(0.7);
  });
});
