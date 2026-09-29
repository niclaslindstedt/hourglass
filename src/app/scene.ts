// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Bulb } from "./sand.ts";

// The camera, the light and the colours: what turns the hourglass's
// geometry (in `glass.ts`'s unit, the whole height) into points on the
// screen and tones on the sand.
//
// The camera is an orthographic one, a little above the glass and a little
// round to one side, the way a product photograph is taken: from above so
// the plates show their top faces and the sand its surface, and to one side
// so a square frame shows two of its faces and four posts stand as four. It
// is the whole of the "3D" here, and it is enough: a bulb is a solid of
// revolution, so its outline is its profile whichever way round it is
// looked at, and everything with a shape of its own is a circle or a square
// at a height. Pure — nothing here touches a canvas.

export type Camera = {
  /** How far above the glass the eye is, in radians. */
  pitch: number;
  /** How far round to one side, in radians. */
  yaw: number;
  /** Pixels per unit of height. */
  scale: number;
  /** Where the waist lands on the canvas. */
  cx: number;
  cy: number;
};

/** The camera the hourglass is photographed by. */
export const PITCH = (8 * Math.PI) / 180;
export const YAW = (-11 * Math.PI) / 180;

export type Point = { x: number; y: number; depth: number };

/** A point in the glass's space (x across, y up, z towards the viewer) on
 *  the screen, and how far towards the viewer it stands. */
export function project(cam: Camera, x: number, y: number, z: number): Point {
  const sx = x * Math.cos(cam.yaw) + z * Math.sin(cam.yaw);
  const depth = -x * Math.sin(cam.yaw) + z * Math.cos(cam.yaw);
  return {
    x: cam.cx + cam.scale * sx,
    y:
      cam.cy -
      cam.scale * (y * Math.cos(cam.pitch) - depth * Math.sin(cam.pitch)),
    depth,
  };
}

/** A horizontal circle of radius `r` at height `y`, as the ellipse it is on
 *  the screen. Yaw does not enter: a circle is a circle from any side. */
export function ellipseOf(
  cam: Camera,
  y: number,
  r: number,
): { cx: number; cy: number; rx: number; ry: number } {
  return {
    cx: cam.cx,
    cy: cam.cy - cam.scale * y * Math.cos(cam.pitch),
    rx: cam.scale * r,
    ry: cam.scale * r * Math.sin(cam.pitch),
  };
}

/** The screen height of a point on the axis at `y`. */
export function axisY(cam: Camera, y: number): number {
  return cam.cy - cam.scale * y * Math.cos(cam.pitch);
}

// ── Light ───────────────────────────────────────────────────────────────────

/** Where the light comes from: above, to the left, and a little in front. */
export const LIGHT = normalize(-0.45, 0.8, 0.5);

function normalize(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}

/** How lit a surface facing `(nx, ny, nz)` is, 0..1: an ambient floor and
 *  the rest by the angle to the light. */
export function lit(
  nx: number,
  ny: number,
  nz: number,
  ambient = 0.55,
): number {
  const n = Math.hypot(nx, ny, nz) || 1;
  const cos = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n;
  return ambient + (1 - ambient) * Math.max(0, cos);
}

/** How lit the side of a vertical cylinder is at `u` across it (−1 at the
 *  left edge, 1 at the right), seen from the front. */
export function cylinderLit(u: number, ambient = 0.5): number {
  const x = Math.min(1, Math.max(-1, u));
  return lit(x, 0, Math.sqrt(1 - x * x), ambient);
}

// ── Colour ──────────────────────────────────────────────────────────────────

export type Rgb = [number, number, number];

/** `#rgb`, `#rrggbb` or `rgb()`/`rgba()` to channels; black for anything
 *  else. Alpha is dropped: the sand is opaque. */
export function rgbOf(color: string): Rgb {
  const text = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const h = hex[1]!;
    const d = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
    return [
      parseInt(d.slice(0, 2), 16),
      parseInt(d.slice(2, 4), 16),
      parseInt(d.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return [0, 0, 0];
}

/** A colour as CSS, with an alpha. */
export function css([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** `a` towards `b` by `t`. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(1, Math.max(0, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

/** A colour at a lightness: darker towards `dark` below 1, lighter towards
 *  `light` above it. */
export function tone(base: Rgb, dark: Rgb, light: Rgb, k: number): Rgb {
  return k < 1 ? mix(dark, base, k) : mix(base, light, Math.min(1, k - 1));
}

// ── The heap, as a surface ──────────────────────────────────────────────────

/** How many spokes a heap's surface is drawn with. */
export const SPOKES = 28;

/** One face of the surface: its four screen corners, its depth (for the
 *  order it is painted in) and how lit it is. */
export type Facet = {
  x: [number, number, number, number];
  y: [number, number, number, number];
  depth: number;
  lit: number;
};

/**
 * The heap's surface as facets: a quad between every two neighbouring rings
 * and every two spokes, from the axis out to the rim, where the surface
 * meets the wall. `baseY` is the world height of the end the sand rests
 * against, and `up` which way the bulb's heights go from it on the screen:
 * +1 when gravity points down the screen, −1 when the phone is upside
 * down and the heaps hang the other way. Sorted far to near, so painting
 * them in order is right.
 */
export function surfaceFacets(
  cam: Camera,
  bulb: Bulb,
  baseY: number,
  up: 1 | -1,
  rimRing: number,
  spokes = SPOKES,
): Facet[] {
  const facets: Facet[] = [];
  if (rimRing < 0) return facets;
  const worldY = (h: number) => baseY + up * h;
  // The rings' centre radii and heights, plus the axis and the rim's outer
  // edge so the surface reaches both.
  const radii: number[] = [0];
  const heights: number[] = [bulb.height[0]!];
  for (let i = 0; i <= rimRing; i++) {
    radii.push(bulb.centre[i]!);
    heights.push(bulb.height[i]!);
  }
  const outer =
    rimRing + 1 < bulb.n
      ? bulb.centre[rimRing + 1]!
      : bulb.centre[rimRing]! * 1.03;
  radii.push(outer);
  // Beyond the rim the surface meets the wall: the next ring's floor, or
  // the wall where the last ring's floor is — read as the sand's floor
  // there, which is where it ends.
  heights.push(
    rimRing + 1 < bulb.n ? bulb.floor[rimRing + 1]! : bulb.height[rimRing]!,
  );

  const da = (2 * Math.PI) / spokes;
  for (let i = 0; i < radii.length - 1; i++) {
    const r0 = radii[i]!;
    const r1 = radii[i + 1]!;
    const h0 = worldY(heights[i]!);
    const h1 = worldY(heights[i + 1]!);
    const slope = (heights[i + 1]! - heights[i]!) / Math.max(1e-9, r1 - r0);
    const len = Math.hypot(1, slope);
    const nr = -slope / len;
    const ny = 1 / len;
    for (let a = 0; a < spokes; a++) {
      const a0 = a * da;
      const a1 = a0 + da;
      const am = a0 + da / 2;
      const p0 = project(cam, r0 * Math.cos(a0), h0, r0 * Math.sin(a0));
      const p1 = project(cam, r1 * Math.cos(a0), h1, r1 * Math.sin(a0));
      const p2 = project(cam, r1 * Math.cos(a1), h1, r1 * Math.sin(a1));
      const p3 = project(cam, r0 * Math.cos(a1), h0, r0 * Math.sin(a1));
      facets.push({
        x: [p0.x, p1.x, p2.x, p3.x],
        y: [p0.y, p1.y, p2.y, p3.y],
        depth: (p0.depth + p1.depth + p2.depth + p3.depth) / 4,
        lit: lit(nr * Math.cos(am), up * ny, nr * Math.sin(am)),
      });
    }
  }
  facets.sort((a, b) => a.depth - b.depth);
  return facets;
}
