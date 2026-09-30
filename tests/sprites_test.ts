// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GLASSES, TOP, TOPS } from "../src/app/look.ts";
import type { Manifest } from "../src/app/sprites.ts";

// The modelled parts the build ships (`public/models/`, made by `make
// blender`): a manifest that names a sprite for every top against every
// glass, a post and a finial where the top has them, and both passes of
// every glass — and every file it names on disk. A top or a glass added to
// `look.ts` fails here until it has been baked.

const dir = join(import.meta.dirname, "..", "public", "models");
const manifest = JSON.parse(
  readFileSync(join(dir, "manifest.json"), "utf8"),
) as Manifest;

describe("the modelled parts", () => {
  it("cover every top against every glass, with their posts and finials", () => {
    for (const top of TOPS) {
      const t = manifest.tops[top];
      expect(t, top).toBeDefined();
      for (const glass of GLASSES) {
        expect(t![`plate-${glass}`], `${top} plate for ${glass}`).toBeDefined();
      }
      const spec = TOP[top];
      if (spec.posts > 0) {
        const posts = spec.post === "band" ? ["post-a", "post-b"] : ["post"];
        for (const p of posts) {
          expect(t![p], `${top} ${p}`).toBeDefined();
          expect(t![p]!.at, `${top} ${p} anchor`).toBeDefined();
        }
      }
      if (spec.finial !== "none") {
        expect(t!["finial"]?.at, `${top} finial`).toBeDefined();
      }
    }
  });

  it("cover every glass in both passes, and the grain", () => {
    for (const glass of GLASSES) {
      const g = manifest.glasses[glass];
      expect(g?.add, `${glass} add`).toBeDefined();
      expect(g?.multiply, `${glass} multiply`).toBeDefined();
    }
    expect(manifest.grain?.file).toBeDefined();
  });

  it("name files that exist, each placed within the frame", () => {
    const records = [
      ...Object.values(manifest.tops).flatMap((t) => Object.values(t)),
      ...Object.values(manifest.glasses).flatMap((g) => [g.add, g.multiply]),
    ];
    expect(records.length).toBeGreaterThan(0);
    for (const s of records) {
      expect(existsSync(join(dir, s.file)), s.file).toBe(true);
      expect(s.w).toBeGreaterThan(0);
      expect(s.h).toBeGreaterThan(0);
      // Inside the hourglass's own reach: a unit tall, well under one wide.
      expect(Math.abs(s.x)).toBeLessThan(0.6);
      expect(Math.abs(s.y)).toBeLessThan(0.7);
    }
    if (manifest.grain) {
      expect(existsSync(join(dir, manifest.grain.file))).toBe(true);
    }
  });
});
