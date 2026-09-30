// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { createView, intoGlass, stepView, viewStill } from "../src/app/view.ts";

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
