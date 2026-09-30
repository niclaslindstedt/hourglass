// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  MAX_LEAN,
  STOP_LEAN,
  gravitySign,
  leanOf,
  leanStops,
  nextGravity,
  screenGravity,
  shakeOf,
} from "../src/app/useMotion.ts";

describe("gravity from the phone", () => {
  it("is down for a phone held upright and up for one held upside down", () => {
    expect(gravitySign(90)).toBeCloseTo(1, 6);
    expect(gravitySign(-90)).toBeCloseTo(-1, 6);
    expect(gravitySign(0)).toBeCloseTo(0, 6);
    expect(gravitySign(null)).toBeNull();
    expect(gravitySign(Number.NaN)).toBeNull();
  });

  it("reads the lean across the screen off the left-right tilt", () => {
    // Upright, no roll: all of it down the screen.
    expect(screenGravity(90, 0)).toEqual({
      down: expect.closeTo(1, 6) as number,
      across: expect.closeTo(0, 6) as number,
    });
    // Flat on a table: nothing in the screen's plane at all.
    const flat = screenGravity(0, 0)!;
    expect(Math.hypot(flat.down, flat.across)).toBeLessThan(1e-6);
    // Flat and rolled so the right-hand side is down: all of it to the right.
    expect(screenGravity(0, 90)!.across).toBeCloseTo(1, 6);
    // Held at forty-five degrees and rolled the same: equal shares.
    const slant = screenGravity(45, 45)!;
    expect(slant.down).toBeCloseTo(Math.SQRT1_2, 6);
    expect(slant.across).toBeCloseTo(0.5, 6);
  });

  it("turns only well past level, and only once, either way", () => {
    expect(nextGravity(1, 0.9)).toBe(1);
    expect(nextGravity(1, 0)).toBe(1);
    expect(nextGravity(1, -0.2)).toBe(1);
    expect(nextGravity(1, -0.5)).toBe(-1);
    expect(nextGravity(-1, -0.9)).toBe(-1);
    expect(nextGravity(-1, 0.2)).toBe(-1);
    expect(nextGravity(-1, 0.5)).toBe(1);
    expect(nextGravity(-1, null)).toBe(-1);
  });
});

describe("the lean the heaps hold", () => {
  it("is the tangent of the tilt, positive to the right, in the glass's own sense", () => {
    expect(leanOf({ down: 1, across: 0 }, 1)).toBeCloseTo(0, 6);
    expect(leanOf({ down: Math.SQRT1_2, across: Math.SQRT1_2 }, 1)).toBeCloseTo(
      1,
      6,
    );
    expect(
      leanOf({ down: Math.SQRT1_2, across: -Math.SQRT1_2 }, 1),
    ).toBeCloseTo(-1, 6);
    // Upside down, the same reading is read against the other end.
    expect(
      leanOf({ down: -Math.SQRT1_2, across: Math.SQRT1_2 }, -1),
    ).toBeCloseTo(1, 6);
  });

  it("is capped where a glass is on its side, and unread when the phone is flat", () => {
    expect(leanOf({ down: 0.05, across: 0.99 }, 1)).toBeCloseTo(MAX_LEAN, 6);
    expect(leanOf({ down: 0.05, across: -0.99 }, 1)).toBeCloseTo(-MAX_LEAN, 6);
    expect(leanOf({ down: 0.1, across: 0.1 }, 1)).toBeNull();
    expect(leanOf(null, 1)).toBeNull();
  });

  it("stops the sand past sixty degrees and not before", () => {
    expect(leanStops(0)).toBe(false);
    expect(leanStops(Math.tan((45 * Math.PI) / 180))).toBe(false);
    expect(leanStops(STOP_LEAN * 1.01)).toBe(true);
    expect(leanStops(-STOP_LEAN * 1.01)).toBe(true);
  });
});

describe("a shake", () => {
  it("is nothing for a phone carried in a hand and everything for a hard one", () => {
    expect(shakeOf(0, 0, 0)).toBe(0);
    expect(shakeOf(1, 1, 1)).toBe(0);
    expect(shakeOf(0, 20, 0)).toBe(1);
    const half = shakeOf(0, 10.25, 0);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
  });
});
