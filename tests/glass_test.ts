// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  POST_CLEARANCE,
  bulbShape,
  layoutOf,
  profileRadius,
} from "../src/app/glass.ts";
import {
  GLASS,
  GLASSES,
  LOOK_PRESET,
  LOOK_PRESETS,
  SANDS,
  TOP,
  TOPS,
} from "../src/app/look.ts";

describe("a profile", () => {
  it("passes through every point it was given", () => {
    for (const id of GLASSES) {
      const spec = GLASS[id];
      for (const [t, r] of spec.profile) {
        expect(profileRadius(spec, t)).toBeCloseTo(r, 9);
      }
    }
  });

  it("never bulges past a point between two of them", () => {
    for (const id of GLASSES) {
      const spec = GLASS[id];
      const points = spec.profile;
      for (let i = 0; i < points.length - 1; i++) {
        const [t0, r0] = points[i]!;
        const [t1, r1] = points[i + 1]!;
        const lo = Math.min(r0, r1) - 1e-9;
        const hi = Math.max(r0, r1) + 1e-9;
        for (let k = 1; k < 20; k++) {
          const r = profileRadius(spec, t0 + ((t1 - t0) * k) / 20);
          expect(r).toBeGreaterThanOrEqual(lo);
          expect(r).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("is held at its ends outside 0..1", () => {
    const spec = GLASS.teardrop;
    expect(profileRadius(spec, -1)).toBe(spec.profile[0]![1]);
    expect(profileRadius(spec, 2)).toBe(
      spec.profile[spec.profile.length - 1]![1],
    );
  });
});

describe("a bulb", () => {
  const shapes = GLASSES.map((id) => [id, bulbShape(GLASS[id], 0.4)] as const);

  it("is widest somewhere between the plate and the waist, and narrowest at the waist", () => {
    for (const [, bulb] of shapes) {
      expect(bulb.widestAt).toBeGreaterThan(0);
      expect(bulb.widestAt).toBeLessThan(bulb.height);
      expect(bulb.waist).toBeLessThan(bulb.foot);
      expect(bulb.waist).toBeLessThan(bulb.radius);
      expect(bulb.bore).toBeLessThan(bulb.waist);
    }
  });

  it("reads its walls back as the heights they stand at", () => {
    for (const [id, bulb] of shapes) {
      // Walk the taper: every height between the waist and the widest point
      // has a radius, and that radius reads back as the height.
      for (let k = 1; k < 20; k++) {
        const s = (bulb.widestAt * k) / 20;
        const r = bulb.radiusAt(s);
        expect(bulb.taper(r), `${id} taper at ${s}`).toBeCloseTo(s, 3);
      }
      // And the dome, from the widest point up to the plate.
      for (let k = 1; k < 20; k++) {
        const s = bulb.widestAt + ((bulb.height - bulb.widestAt) * k) / 20;
        const r = bulb.radiusAt(s);
        expect(bulb.dome(r), `${id} dome at ${s}`).toBeCloseTo(s, 3);
      }
    }
  });

  it("puts the taper's floor at the waist inside the hole and the dome's at the plate inside the foot", () => {
    for (const [, bulb] of shapes) {
      expect(bulb.taper(0)).toBe(0);
      expect(bulb.taper(bulb.bore)).toBe(0);
      expect(bulb.dome(0)).toBe(bulb.height);
      expect(bulb.dome(bulb.foot * 0.5)).toBe(bulb.height);
      // Past the widest radius both walls answer with the widest point.
      expect(bulb.taper(bulb.radius * 2)).toBeCloseTo(bulb.widestAt, 9);
      expect(bulb.dome(bulb.radius * 2)).toBeCloseTo(bulb.widestAt, 9);
    }
  });
});

describe("a layout", () => {
  it("leaves the two bulbs exactly the height the plates do not take", () => {
    for (const id of LOOK_PRESETS) {
      const look = LOOK_PRESET[id];
      const layout = layoutOf(look);
      expect(layout.thick).toBe(TOP[look.top].thick);
      expect(2 * layout.bulb.height + 2 * layout.thick).toBeCloseTo(1, 9);
      // The glass never reaches past the plates it stands between — but a
      // frameless glass's ground ends hold its foot, not its widest.
      if (TOP[look.top].posts === 0) {
        expect(layout.reach).toBeGreaterThan(layout.bulb.foot);
      } else {
        expect(layout.bulb.radius).toBeLessThan(layout.reach);
      }
    }
  });

  it("stands every top's posts clear of every glass, and its plates past the posts", () => {
    for (const top of TOPS) {
      for (const glass of GLASSES) {
        const layout = layoutOf({ top, glass, sand: SANDS[0]! });
        const spec = TOP[top];
        if (spec.posts === 0) continue;
        // A square's posts are at its corners — a diagonal from the axis.
        const fromAxis =
          spec.plate === "square" ? layout.postAt * Math.SQRT2 : layout.postAt;
        expect(fromAxis - spec.postR, `${top} ${glass}`).toBeGreaterThanOrEqual(
          layout.bulb.radius + POST_CLEARANCE - 1e-9,
        );
        expect(layout.reach).toBeGreaterThan(layout.postAt + spec.postR);
        // A frame never shrinks below what it was drawn as.
        expect(layout.reach).toBeGreaterThanOrEqual(spec.reach - 1e-9);
      }
    }
  });
});
