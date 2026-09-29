// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  GLASS,
  GLASSES,
  LOOK_PRESET,
  LOOK_PRESETS,
  SAND,
  SANDS,
  TOP,
  TOPS,
  clampLook,
  resolveLook,
} from "../src/app/look.ts";

// Every option is an id and a spec, so the tables can be walked: a preset
// that named a top nobody drew would otherwise be found by the reader who
// picked it.

describe("the vocabulary", () => {
  it("has eight tops, six glasses and eight sands, each with a spec", () => {
    expect(TOPS).toHaveLength(8);
    expect(GLASSES).toHaveLength(6);
    expect(SANDS).toHaveLength(8);
    for (const id of TOPS) expect(TOP[id]).toBeDefined();
    for (const id of GLASSES) expect(GLASS[id]).toBeDefined();
    for (const id of SANDS) expect(SAND[id]).toBeDefined();
  });

  it("gives every glass a profile that starts at the plate and ends at the waist, narrower than it began", () => {
    for (const id of GLASSES) {
      const { profile, bore } = GLASS[id];
      expect(profile[0]![0]).toBe(0);
      expect(profile[profile.length - 1]![0]).toBe(1);
      expect(Math.max(...profile.map((p) => p[1]))).toBe(1);
      expect(profile[profile.length - 1]![1]).toBeLessThan(0.2);
      expect(bore).toBeLessThan(profile[profile.length - 1]![1]);
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i]![0]).toBeGreaterThan(profile[i - 1]![0]);
      }
    }
  });

  it("gives every sand an angle of repose a heap of it could hold", () => {
    for (const id of SANDS) {
      expect(SAND[id].repose).toBeGreaterThanOrEqual(20);
      expect(SAND[id].repose).toBeLessThanOrEqual(40);
    }
  });

  it("gives every top plates wider than the widest glass", () => {
    const widest = Math.max(...GLASSES.map((g) => GLASS[g].radius));
    for (const id of TOPS) {
      expect(TOP[id].reach).toBeGreaterThan(widest * 0.7);
    }
  });
});

describe("the presets", () => {
  it("are ten, each a top, a glass and a sand that exist", () => {
    expect(LOOK_PRESETS).toHaveLength(10);
    for (const id of LOOK_PRESETS) {
      const look = LOOK_PRESET[id];
      expect(TOPS).toContain(look.top);
      expect(GLASSES).toContain(look.glass);
      expect(SANDS).toContain(look.sand);
    }
  });

  it("are all different from one another", () => {
    const seen = new Set(
      LOOK_PRESETS.map((id) => JSON.stringify(LOOK_PRESET[id])),
    );
    expect(seen.size).toBe(LOOK_PRESETS.length);
  });

  it("between them show every top, every glass and all but one sand", () => {
    const tops = new Set(LOOK_PRESETS.map((id) => LOOK_PRESET[id].top));
    const glasses = new Set(LOOK_PRESETS.map((id) => LOOK_PRESET[id].glass));
    const sands = new Set(LOOK_PRESETS.map((id) => LOOK_PRESET[id].sand));
    expect(tops.size).toBe(TOPS.length);
    expect(glasses.size).toBe(GLASSES.length);
    expect(sands.size).toBeGreaterThanOrEqual(SANDS.length - 1);
  });

  it("resolve to themselves, and Custom to the custom look", () => {
    const custom = { top: "pine", glass: "cone", sand: "pink" } as const;
    expect(resolveLook("harbor", custom)).toEqual(LOOK_PRESET.harbor);
    expect(resolveLook("custom", custom)).toEqual(custom);
  });
});

describe("a stored look", () => {
  it("keeps what exists and falls back field by field", () => {
    expect(clampLook({ top: "brass", glass: "cone", sand: "gold" })).toEqual({
      top: "brass",
      glass: "cone",
      sand: "gold",
    });
    expect(clampLook({ top: "mahogany", glass: 3, sand: "gold" })).toEqual({
      ...LOOK_PRESET.study,
      sand: "gold",
    });
    expect(clampLook(null)).toEqual(LOOK_PRESET.study);
    expect(clampLook("walnut")).toEqual(LOOK_PRESET.study);
  });
});
