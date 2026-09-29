// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { GLASS, TOP, type GlassSpec, type Look } from "./look.ts";

// The glass's geometry: a bulb's radius along its height, and the same
// curve read the other way round — at what height the wall stands at a
// given radius — which is what the sand needs to know where it can rest.
//
// Everything is in one unit: the hourglass's whole height, plates included,
// is 1. A bulb runs from the plate end (t = 0) to the waist (t = 1); the two
// bulbs are the same profile twice, meeting at the waist, and `s` measures
// the height above that meeting plane inside one bulb. Pure and clock-free.

/** The height of the whole hourglass, the unit everything is drawn in. */
export const HEIGHT = 1;

/**
 * The profile's radius at `t` (0 at the plate end, 1 at the waist), as a
 * share of the bulb's widest radius — a monotone cubic through the spec's
 * points (Fritsch–Carlson), so the curve passes through every point and
 * never bulges past one between them.
 */
export function profileRadius(spec: GlassSpec, t: number): number {
  const points = spec.profile;
  const n = points.length;
  if (n === 0) return 0;
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= points[0]![0]) return points[0]![1];
  if (clamped >= points[n - 1]![0]) return points[n - 1]![1];

  // Secant slopes, then the tangent at each point: the harmonic mean of the
  // two secants where they agree in sign, zero where they do not (an
  // extremum), which is what keeps the interpolant from overshooting.
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    d.push((y1 - y0) / (x1 - x0));
  }
  const m: number[] = new Array<number>(n).fill(0);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1]!;
    const b = d[i]!;
    m[i] = a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  }

  let i = 0;
  while (i < n - 2 && clamped > points[i + 1]![0]) i++;
  const [x0, y0] = points[i]!;
  const [x1, y1] = points[i + 1]!;
  const h = x1 - x0;
  const u = (clamped - x0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * y0 + h10 * h * m[i]! + h01 * y1 + h11 * h * m[i + 1]!;
}

/** How finely a profile is sampled for the inverse lookups. */
const SAMPLES = 256;

/** One bulb, sampled: the radius at every height, and the two walls read
 *  back as heights at a radius. */
export type BulbShape = {
  /** The bulb's height, from the waist to the plate. */
  height: number;
  /** The widest radius. */
  radius: number;
  /** The radius at the waist, where the two bulbs meet. */
  waist: number;
  /** The radius of the hole the sand runs through. */
  bore: number;
  /** The radius where the bulb meets the plate. */
  foot: number;
  /** The height above the waist of the widest point. */
  widestAt: number;
  /** The radius at a height `s` above the waist (0 ≤ s ≤ height). */
  radiusAt: (s: number) => number;
  /** The height above the waist at which the taper — the wall between the
   *  waist and the widest point — stands at radius `r`. Zero inside the
   *  waist; the widest point's height beyond the widest radius. */
  taper: (r: number) => number;
  /** The height above the waist at which the dome — the wall between the
   *  widest point and the plate — stands at radius `r`. The bulb's height
   *  inside the foot; the widest point's height beyond the widest radius. */
  dome: (r: number) => number;
};

/** The bulb for a glass, at the height the frame leaves it. */
export function bulbShape(spec: GlassSpec, height: number): BulbShape {
  const radius = spec.radius;
  // Sampled from the plate end (t = 0) to the waist (t = 1).
  const r = new Float64Array(SAMPLES);
  let widest = 0;
  for (let i = 0; i < SAMPLES; i++) {
    r[i] = profileRadius(spec, i / (SAMPLES - 1)) * radius;
    if (r[i]! > r[widest]!) widest = i;
  }
  const sOf = (i: number) => height * (1 - i / (SAMPLES - 1));
  const tOf = (s: number) => (1 - s / height) * (SAMPLES - 1);

  const radiusAt = (s: number): number => {
    const x = Math.min(SAMPLES - 1, Math.max(0, tOf(s)));
    const i = Math.floor(x);
    const j = Math.min(SAMPLES - 1, i + 1);
    const f = x - i;
    return r[i]! * (1 - f) + r[j]! * f;
  };

  // The taper is r[widest..SAMPLES-1] — decreasing towards the waist — read
  // as a height for a radius; the dome is r[0..widest], increasing from the
  // foot to the widest point. Both are monotone, so a binary search finds
  // the sample and a linear step lands between two.
  const taper = (target: number): number => {
    if (target >= r[widest]!) return sOf(widest);
    if (target <= r[SAMPLES - 1]!) return 0;
    let lo = widest;
    let hi = SAMPLES - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r[mid]! >= target) lo = mid;
      else hi = mid;
    }
    const f = (r[lo]! - target) / (r[lo]! - r[hi]!);
    return sOf(lo + f);
  };
  const dome = (target: number): number => {
    if (target >= r[widest]!) return sOf(widest);
    if (target <= r[0]!) return height;
    let lo = 0;
    let hi = widest;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r[mid]! <= target) lo = mid;
      else hi = mid;
    }
    const f = (target - r[lo]!) / (r[hi]! - r[lo]!);
    return sOf(lo + f);
  };

  return {
    height,
    radius: r[widest]!,
    waist: r[SAMPLES - 1]!,
    bore: spec.bore * radius,
    foot: r[0]!,
    widestAt: sOf(widest),
    radiusAt,
    taper,
    dome,
  };
}

/** Where everything stands, for one look: the plates, and the bulb between
 *  them. The waist is at height 0; the top plate's underside is at
 *  `+bulb.height`, the bottom plate's top at `−bulb.height`. */
export type Layout = {
  /** The plate's half-width (a square's half side, a disc's radius) and
   *  thickness. */
  reach: number;
  thick: number;
  /** How far from the axis the posts stand. */
  postAt: number;
  /** The one bulb shape both bulbs are. */
  bulb: BulbShape;
};

/** The room a post keeps between itself and the glass at its widest. */
export const POST_CLEARANCE = 0.012;
/** How far in from the plate's edge a post stands. */
const POST_INSET = 0.02;

/** A frame is made to fit its glass: the posts stand clear of the bulb at
 *  its widest, and the plates reach past the posts — so a wide glass in a
 *  small frame gets a frame that grew to hold it, never a post through the
 *  bulb. A square's posts stand at its corners, so their distance from the
 *  axis is a diagonal; a disc's stand on a circle. */
export function layoutOf(look: Look): Layout {
  const top = TOP[look.top];
  const height = (HEIGHT - 2 * top.thick) / 2;
  const bulb = bulbShape(GLASS[look.glass], height);
  if (top.posts === 0) {
    // A frameless glass stands on its own ground ends, a little wider than
    // the foot they hold — never as wide as the bulb, which is what makes
    // it a glass rather than a frame.
    const reach = Math.max(top.reach, bulb.foot * 1.2);
    return { reach, thick: top.thick, postAt: 0, bulb };
  }
  const clear = bulb.radius + top.postR + POST_CLEARANCE;
  const inset = top.reach - top.postR - POST_INSET;
  if (top.plate === "square") {
    const postAt = Math.max(inset, clear / Math.SQRT2);
    return {
      reach: postAt + top.postR + POST_INSET,
      thick: top.thick,
      postAt,
      bulb,
    };
  }
  const postAt = Math.max(inset, clear);
  return {
    reach: postAt + top.postR + POST_INSET,
    thick: top.thick,
    postAt,
    bulb,
  };
}
