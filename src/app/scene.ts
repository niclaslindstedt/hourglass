// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { rimAt, type Bulb } from "./sand.ts";

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

/** One face of the surface: its four screen corners, its depth (for the
 *  order it is painted in) and how lit it is. */
export type Facet = {
  x: [number, number, number, number];
  y: [number, number, number, number];
  depth: number;
  lit: number;
};

/** Where the sand meets the wall along spoke `a`: the radius and the height
 *  (from the resting end) of the edge of the heap there, or null on a spoke
 *  with no sand. */
export function rimEdge(
  bulb: Bulb,
  a: number,
): { r: number; h: number } | null {
  const i = rimAt(bulb, a);
  if (i < 0) return null;
  const h = bulb.height[i * bulb.m + a]!;
  if (i + 1 < bulb.n) {
    // The wall rises from this ring's floor to the next ring's; the sand's
    // surface meets it where the wall reaches the sand's own height —
    // between the two ring centres, so a leaning heap's edge runs smoothly
    // round the glass rather than stepping from ring to ring.
    const f0 = bulb.floor[i]!;
    const f1 = bulb.floor[i + 1]!;
    const r0 = bulb.centre[i]!;
    const r1 = bulb.centre[i + 1]!;
    if (f1 > h && f1 > f0) {
      const t = Math.min(1, Math.max(0, (h - f0) / (f1 - f0)));
      return { r: r0 + (r1 - r0) * t, h };
    }
    return { r: r1, h: f1 };
  }
  return { r: bulb.centre[i]! * 1.03, h };
}

/**
 * The heap's surface as facets: a quad between every four neighbouring
 * cells' centres from the axis out, a fan over the axis itself, and a skirt
 * from the last cell with sand on each spoke out to the wall. `baseY` is
 * the world height of the end the sand rests against, and `up` which way
 * the bulb's heights go from it on the screen: +1 when gravity points down
 * the screen, −1 when the phone is upside down and the heaps hang the
 * other way. Each facet is lit by its own normal, so a heap leaning into a
 * tilt is lit as it leans. Sorted far to near, so painting them in order
 * is right.
 */
export function surfaceFacets(
  cam: Camera,
  bulb: Bulb,
  baseY: number,
  up: 1 | -1,
): Facet[] {
  const facets: Facet[] = [];
  const { n, m, centre, height } = bulb;
  const worldY = (h: number) => baseY + up * h;
  type P3 = [number, number, number];
  const at = (r: number, t: number, h: number): P3 => [
    r * Math.cos(t),
    worldY(h),
    r * Math.sin(t),
  ];
  const push = (c: [P3, P3, P3, P3]) => {
    const [p0, p1, p2, p3] = c;
    const s0 = project(cam, p0[0], p0[1], p0[2]);
    const s1 = project(cam, p1[0], p1[1], p1[2]);
    const s2 = project(cam, p2[0], p2[1], p2[2]);
    const s3 = project(cam, p3[0], p3[1], p3[2]);
    // The normal from two edges, turned to face away from the sand — up
    // the bulb's heights, which is `up` on the screen.
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0];
    const vy = p3[1] - p0[1];
    const vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    if (ny * up < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    facets.push({
      x: [s0.x, s1.x, s2.x, s3.x],
      y: [s0.y, s1.y, s2.y, s3.y],
      depth: (s0.depth + s1.depth + s2.depth + s3.depth) / 4,
      lit: nx === 0 && ny === 0 && nz === 0 ? lit(0, up, 0) : lit(nx, ny, nz),
    });
  };
  const angle = (a: number) => ((a + 0.5) * 2 * Math.PI) / m;
  const cell = (i: number, a: number) => height[i * m + ((a + m) % m)]!;
  const edge: ({ r: number; h: number } | null)[] = [];
  let any = false;
  for (let a = 0; a < m; a++) {
    const e = rimEdge(bulb, a);
    edge.push(e);
    if (e) any = true;
  }
  if (!any) return facets;

  // Over the axis: a fan from the mean of the innermost ring to its cells.
  let axis = 0;
  for (let a = 0; a < m; a++) axis += cell(0, a);
  axis /= m;
  const r0 = centre[0]!;
  for (let a = 0; a < m; a++) {
    const t0 = angle(a);
    const t1 = angle(a + 1);
    const o = at(0, 0, axis);
    push([o, at(r0, t0, cell(0, a)), at(r0, t1, cell(0, a + 1)), o]);
  }
  // Between the rings, out to the last ring with sand on each spoke — a
  // spoke whose sand ends before its neighbour's contributes its own edge
  // on the wall from there on, so the surface between them is the slope
  // of the sand and never a climb up the glass.
  const rims: number[] = [];
  for (let a = 0; a < m; a++) rims.push(rimAt(bulb, a));
  const point = (i: number, a: number): P3 => {
    const aa = (a + m) % m;
    const t = angle(aa);
    const ra = rims[aa]!;
    if (i <= ra) return at(centre[i]!, t, cell(i, aa));
    const e = edge[aa]!;
    return at(e.r, t, e.h);
  };
  for (let a = 0; a < m; a++) {
    const ra = rims[a]!;
    const rb = rims[(a + 1) % m]!;
    if (ra < 0 && rb < 0) continue;
    const to = Math.max(ra, rb);
    for (let i = 0; i < to && i + 1 < n; i++) {
      push([
        point(i, a),
        point(i + 1, a),
        point(i + 1, a + 1),
        point(i, a + 1),
      ]);
    }
    // The skirt: from the last cell with sand out to the wall.
    if (ra >= 0 && rb >= 0) {
      push([point(ra, a), point(n, a), point(n, a + 1), point(rb, a + 1)]);
    }
  }
  facets.sort((a, b) => a.depth - b.depth);
  return facets;
}
