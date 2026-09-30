// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { counterTurn, uprightDelta } from "../src/app/upright.ts";

describe("the page stands tall however the phone's screen turns", () => {
  it("turns the page back against a phone laid on its side", () => {
    // Turned to the left, the browser drew the page a quarter clockwise;
    // it is turned back a quarter the other way, and the same the other
    // way round.
    expect(counterTurn(90, 956, 440, true)).toBe(270);
    expect(counterTurn(-90, 956, 440, true)).toBe(90);
    expect(counterTurn(270, 956, 440, true)).toBe(90);
  });

  it("turns the page back from upside down, so nothing spins round", () => {
    expect(counterTurn(180, 440, 956, true)).toBe(180);
  });

  it("leaves a phone held upright alone", () => {
    expect(counterTurn(0, 440, 956, true)).toBe(0);
  });

  it("leaves a desk, and a tablet that is landscape by nature, alone", () => {
    expect(counterTurn(90, 1440, 900, false)).toBe(0);
    expect(counterTurn(180, 900, 1440, false)).toBe(0);
    // A landscape-first tablet held in portrait reports a turn, but the
    // page is already tall.
    expect(counterTurn(90, 800, 1280, true)).toBe(0);
    expect(counterTurn(0, 1280, 800, true)).toBe(0);
  });

  it("reads a drag along the page's own length once it is turned back", () => {
    // Turned back a quarter clockwise, the page's top is the screen's
    // right: a drag to the right on the screen is a drag up the page.
    expect(uprightDelta(10, 0, 90)).toEqual([0, -10]);
    // A quarter the other way, the page's top is the screen's left.
    expect(uprightDelta(-10, 0, 270)).toEqual([-0, -10]);
    // Upside down, everything is the other way.
    expect(uprightDelta(3, 4, 180)).toEqual([-3, -4]);
    expect(uprightDelta(3, 4, 0)).toEqual([3, 4]);
  });
});
