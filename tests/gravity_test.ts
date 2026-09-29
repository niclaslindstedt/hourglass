// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { gravitySign, nextGravity } from "../src/app/useGravity.ts";

// The sensor decides one thing: whether gravity points down the screen or
// up it. Everything else about how the phone is held changes nothing.

describe("gravity from the phone", () => {
  it("is down for a phone held upright and up for one held upside down", () => {
    expect(gravitySign(90)).toBeCloseTo(1, 9);
    expect(gravitySign(-90)).toBeCloseTo(-1, 9);
    expect(gravitySign(0)).toBeCloseTo(0, 9);
    expect(gravitySign(null)).toBeNull();
    expect(gravitySign(Number.NaN)).toBeNull();
  });

  it("turns only well past level, and only once, either way", () => {
    // Upright, leaning back a little, flat: still down.
    expect(nextGravity(1, 1)).toBe(1);
    expect(nextGravity(1, 0.3)).toBe(1);
    expect(nextGravity(1, 0)).toBe(1);
    expect(nextGravity(1, -0.3)).toBe(1);
    // Past a third of a right angle the other way: up.
    expect(nextGravity(1, -0.4)).toBe(-1);
    expect(nextGravity(-1, -1)).toBe(-1);
    // And back: not at level, but past it.
    expect(nextGravity(-1, 0.3)).toBe(-1);
    expect(nextGravity(-1, 0.4)).toBe(1);
    // No reading changes nothing.
    expect(nextGravity(-1, null)).toBe(-1);
  });
});
