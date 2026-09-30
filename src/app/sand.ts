// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { BulbShape } from "./glass.ts";

// The sand, as a heap: what shape it takes in a bulb, and how it moves.
//
// A bulb is round, and the sand in it is very nearly so — a funnel above the
// hole, a cone under the stream — so the heap is kept as cells: rings out
// from the axis, each cut into spokes, and the surface height at each cell.
// A cell's volume is its area times the sand standing in it, so the model
// is exact in three dimensions rather than a picture of a slice: draining a
// tenth of the volume drains a tenth of the sand, wherever it stands. The
// spokes are what let the heap lean: a glass held at a slant has its sand
// piled to one side, and a heap that was only rings could not say so.
//
// Three rules move it. Sand leaves through the hole and lands where the
// stream falls (`drain`, `pour`); wherever the surface is steeper than the
// sand's angle of repose — measured against gravity, which need not point
// down the bulb's axis (`setTilt`) — sand slides down until it is not
// (`relax`); and a shaken glass throws grains about (`jolt`) and lets the
// heap slump flatter than it would hold at rest (`give`). Everything the
// eye reads as an hourglass — the funnel deepening, the cone spreading, the
// last of the top sliding in from the walls, a heap leaning into a tilt — is
// those rules. Pure, clock-free, and without a random number in it: what
// looks like chance is a hash of a seed the caller hands in.

/** Which end of the bulb gravity pulls the sand towards: the waist, in the
 *  top bulb, or the plate, in the bottom one. Heights in a bulb are measured
 *  from that end. */
export type Rest = "waist" | "plate";

export type Bulb = {
  /** The end the sand rests against. */
  rest: Rest;
  /** How many rings the heap is kept in, and how many spokes each is cut
   *  into. A cell is ring `i`, spoke `a`, at index `i * m + a`. */
  n: number;
  m: number;
  /** The rings' centre radii and whole areas (a cell has `area / m`). */
  centre: Float64Array;
  area: Float64Array;
  /** The wall under the sand, and the wall over it, at each ring's centre:
   *  heights from the resting end. */
  floor: Float64Array;
  ceiling: Float64Array;
  /** The surface: the height the sand stands to in each cell, the ring's
   *  `floor` where there is none. */
  height: Float64Array;
  /** The slope the sand holds at rest, as a tangent. */
  slope: number;
  /** Gravity's lean across the bulb (`setTilt`): its share across the axis
   *  over its share along it, as x and z. Zero when it points straight
   *  down the axis. */
  tilt: [number, number];
  /** What the tilt adds to each cell's height to make a level surface read
   *  level: sand leans towards the side gravity leans to, so a settled
   *  surface stands higher there in the bulb's own frame. A spinning heap
   *  adds a bowl to it (`bowl`). */
  lean: Float64Array;
  /** How fast the sand turns about the glass's axis, rad/s: the glass's
   *  spin, taken up by friction (`physics.ts`, `whirl`). */
  whirl: number;
  /** The bowl the spin makes of a level surface: its curvature, ω²
   *  over gravity along the axis (a height's worth over a height
   *  squared), with which the lean rises towards the wall as r²/2. */
  bowl: number;
  /** How shaken the glass is, 0..1: a heap in a shaken glass holds a flatter
   *  slope than one at rest. */
  give: number;
  /** The bulb's shape, for the grains in the air to hit (`physics.ts`). */
  shape: BulbShape;
  /** Gravity in the bulb's frame, in g: across (x), along the heights (y,
   *  negative towards the resting end) and across (z). What the glass's
   *  own acceleration adds is in it too (`setGravity`). */
  g: [number, number, number];
  /** The glass being turned over about its waist (`physics.ts`,
   *  `setSpin`), or null while it is not: what the turn adds to the pull
   *  each grain feels, where it is. */
  spin: Spin | null;
  /** The flowing layer's speed on every edge between two cells, in units
   *  of height a second (`physics.ts`): out along each spoke (`vr`, ring
   *  `i` to `i + 1`) and round each ring (`va`, spoke `a` to `a + 1`). */
  vr: Float64Array;
  va: Float64Array;
  /** The grains in the air: the dilute layer (`physics.ts`). */
  air: Air;
  /** How hard grains have struck the glass since it was last asked, as
   *  volume times speed squared, over the bulb's capacity. */
  hits: number;
  /** Whether the heap has been thrown up by the pull that is on it now:
   *  a shake throws once per stroke, not once per frame. */
  thrown: boolean;
};

/** A turning glass, in the bulb's frame: its angular speed (rad/s) and
 *  angular acceleration (rad/s²) about the waist, and the pull the turn
 *  adds at the heap's middle (in g), which `g` carries and `fly` and
 *  `letGo` swap for the pull where each grain or cell is. */
export type Spin = {
  w: [number, number, number];
  alpha: [number, number, number];
  base: [number, number, number];
};

/** The grains in the air, as parallel arrays: where each is in the bulb's
 *  frame (x and z across, y the height from the resting end), how fast it
 *  moves, and how much sand it carries. `count` are live. */
export type Air = {
  count: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  vz: Float64Array;
  vol: Float64Array;
};

/** How many grains a bulb keeps in the air at most. */
export const AIR_CAP = 4800;

function createAir(): Air {
  return {
    count: 0,
    x: new Float64Array(AIR_CAP),
    y: new Float64Array(AIR_CAP),
    z: new Float64Array(AIR_CAP),
    vx: new Float64Array(AIR_CAP),
    vy: new Float64Array(AIR_CAP),
    vz: new Float64Array(AIR_CAP),
    vol: new Float64Array(AIR_CAP),
  };
}

/** How many rings a bulb is kept in, and how many spokes. */
export const RINGS = 32;
export const SPOKES = 24;

/** Below this much sand a cell counts as empty. A cell is a small thing —
 *  a ring's share over the spokes — so this is well under what one holds. */
const EPSILON = 1e-13;

/** How much flatter a fully shaken heap holds than one at rest. */
const GIVE_SLOPE = 0.6;

/** The angle a spoke's centre stands at round the axis. */
export function spokeAngle(bulb: Bulb, a: number): number {
  return ((a + 0.5) * 2 * Math.PI) / bulb.m;
}

/** A bulb with no sand in it. */
export function createBulb(
  shape: BulbShape,
  rest: Rest,
  reposeDegrees: number,
  n = RINGS,
  m = SPOKES,
): Bulb {
  const centre = new Float64Array(n);
  const area = new Float64Array(n);
  const floor = new Float64Array(n);
  const ceiling = new Float64Array(n);
  const dr = shape.radius / n;
  for (let i = 0; i < n; i++) {
    const inner = i * dr;
    const outer = inner + dr;
    centre[i] = (inner + outer) / 2;
    area[i] = Math.PI * (outer * outer - inner * inner);
    // The two walls, read at the ring's centre. Resting against the waist
    // the floor is the taper and the ceiling the dome; against the plate it
    // is the other way up, and the heights count from the plate.
    const taper = shape.taper(centre[i]!);
    const dome = shape.dome(centre[i]!);
    if (rest === "waist") {
      floor[i] = taper;
      ceiling[i] = dome;
    } else {
      floor[i] = shape.height - dome;
      ceiling[i] = shape.height - taper;
    }
  }
  const height = new Float64Array(n * m);
  for (let i = 0; i < n; i++) height.fill(floor[i]!, i * m, (i + 1) * m);
  return {
    rest,
    n,
    m,
    centre,
    area,
    floor,
    ceiling,
    height,
    slope: Math.tan((reposeDegrees * Math.PI) / 180),
    tilt: [0, 0],
    lean: new Float64Array(n * m),
    whirl: 0,
    bowl: 0,
    give: 0,
    shape,
    g: [0, -1, 0],
    spin: null,
    vr: new Float64Array(n * m),
    va: new Float64Array(n * m),
    air: createAir(),
    hits: 0,
    thrown: false,
  };
}

/**
 * Where gravity leans, across the bulb: `tx` and `tz` are its share across
 * the axis over its share along it (the tangent of the tilt, as x and z),
 * so `[0, 0]` is a glass standing straight and `[1, 0]` one held at
 * forty-five degrees with its right-hand side down. The heap does not move
 * here — it is `relax` that brings it to the new level over the next
 * sweeps, which is what a heap does.
 */
export function setTilt(bulb: Bulb, tx: number, tz: number): void {
  const k = 1 / Math.hypot(1, tx, tz);
  bulb.g = [tx * k, -k, tz * k];
  leanTo(bulb, tx, tz);
}

/** The lean alone: what `setTilt` does to the heights' reading, without
 *  touching gravity's strength. `bowl` is a spinning heap's (`Bulb.bowl`),
 *  its slope held to `steepest` (a tangent) where the spin would stand it
 *  against the wall. */
export function leanTo(
  bulb: Bulb,
  tx: number,
  tz: number,
  bowl = 0,
  steepest = Infinity,
): void {
  bulb.tilt = [tx, tz];
  bulb.bowl = bowl;
  // Past this radius the bowl's slope, bowl·r, is held at `steepest`.
  const knee = bowl > 0 ? steepest / bowl : Infinity;
  for (let i = 0; i < bulb.n; i++) {
    const r = bulb.centre[i]!;
    // A level surface in a spinning glass is a bowl, h = h0 + bowl·r²/2
    // (the pull out from the axis, ω²r, over gravity along it, is its
    // slope).
    const dish =
      r <= knee
        ? (bowl * r * r) / 2
        : (bowl * knee * knee) / 2 + steepest * (r - knee);
    for (let a = 0; a < bulb.m; a++) {
      const t = spokeAngle(bulb, a);
      // A level surface under leaning gravity stands at
      // h = h0 + tx·x + tz·z in the bulb's frame, so subtracting that
      // makes it read level: that is the lean.
      bulb.lean[i * bulb.m + a] = -(
        tx * r * Math.cos(t) +
        tz * r * Math.sin(t) +
        dish
      );
    }
  }
}

/** How much sand the bulb could hold. */
export function capacity(bulb: Bulb): number {
  let v = 0;
  for (let i = 0; i < bulb.n; i++) {
    v += bulb.area[i]! * (bulb.ceiling[i]! - bulb.floor[i]!);
  }
  return v;
}

/** How much sand is in it. */
export function volume(bulb: Bulb): number {
  let v = 0;
  const { n, m, area, floor, height } = bulb;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) v += cell * (height[i * m + a]! - floor[i]!);
  }
  return v;
}

/** The outermost ring with sand in it along spoke `a`, or −1. */
export function rimAt(bulb: Bulb, a: number): number {
  for (let i = bulb.n - 1; i >= 0; i--) {
    if (bulb.height[i * bulb.m + a]! - bulb.floor[i]! > EPSILON) return i;
  }
  return -1;
}

/** The outermost ring with sand in it on any spoke, or −1. */
export function rim(bulb: Bulb): number {
  let worst = -1;
  for (let a = 0; a < bulb.m; a++) worst = Math.max(worst, rimAt(bulb, a));
  return worst;
}

/** The height the sand stands to on the axis: the mean of the innermost
 *  ring, which is as near the axis as the heap is kept. */
export function axisHeight(bulb: Bulb): number {
  let h = 0;
  for (let a = 0; a < bulb.m; a++) h += bulb.height[a]!;
  return h / bulb.m;
}

/** Empty the bulb: the heap, the flow on it and the grains in the air. */
export function clear(bulb: Bulb): void {
  for (let i = 0; i < bulb.n; i++) {
    bulb.height.fill(bulb.floor[i]!, i * bulb.m, (i + 1) * bulb.m);
  }
  bulb.vr.fill(0);
  bulb.va.fill(0);
  bulb.air.count = 0;
}

/** The cell a point across the bulb falls in. */
export function cellAt(bulb: Bulb, x: number, z: number): [number, number] {
  const r = Math.hypot(x, z);
  const dr = bulb.centre[0]! * 2;
  const i = Math.min(bulb.n - 1, Math.floor(r / dr));
  let t = Math.atan2(z, x);
  if (t < 0) t += 2 * Math.PI;
  const a = Math.min(bulb.m - 1, Math.floor((t / (2 * Math.PI)) * bulb.m));
  return [i, a];
}

/** Fill one cell up to the wall over it; what did not fit comes back. */
export function fillCell(
  bulb: Bulb,
  i: number,
  a: number,
  amount: number,
): number {
  const cell = bulb.area[i]! / bulb.m;
  const k = i * bulb.m + a;
  const room = (bulb.ceiling[i]! - bulb.height[k]!) * cell;
  const take = Math.min(Math.max(0, room), amount);
  if (take <= 0) return amount;
  bulb.height[k] = bulb.height[k]! + take / cell;
  return amount - take;
}

/**
 * Add sand where the stream lands: on the axis, or at a point across the
 * bulb when the stream falls at a slant. A cell full to the wall over it
 * passes the rest outward along its spoke, then inward, then round. Returns
 * what could not be placed — only ever when the bulb is full.
 */
export function pour(bulb: Bulb, amount: number, x = 0, z = 0): number {
  let left = amount;
  if (x === 0 && z === 0) {
    // On the axis: every spoke of the innermost ring takes its share, then
    // the next ring out.
    for (let i = 0; i < bulb.n && left > EPSILON; i++) {
      const share = left / bulb.m;
      let back = 0;
      for (let a = 0; a < bulb.m; a++) back += fillCell(bulb, i, a, share);
      left = back;
    }
    return left;
  }
  const [i0, a0] = cellAt(bulb, x, z);
  for (let i = i0; i < bulb.n && left > EPSILON; i++) {
    left = fillCell(bulb, i, a0, left);
  }
  for (let i = i0 - 1; i >= 0 && left > EPSILON; i--) {
    left = fillCell(bulb, i, a0, left);
  }
  for (let d = 1; d < bulb.m && left > EPSILON; d++) {
    const a = (a0 + d) % bulb.m;
    for (let i = 0; i < bulb.n && left > EPSILON; i++) {
      left = fillCell(bulb, i, a, left);
    }
  }
  return left;
}

/**
 * Take sand out through the hole at the axis. The innermost sand goes
 * first, every spoke giving what it has; relaxing afterwards is what brings
 * the rest down to it. Returns what was taken — less than asked only when
 * the bulb has run out.
 */
export function drain(bulb: Bulb, amount: number): number {
  let left = amount;
  const { n, m, area, floor, height } = bulb;
  for (let i = 0; i < n && left > EPSILON; i++) {
    const cell = area[i]! / m;
    let have = 0;
    for (let a = 0; a < m; a++) have += (height[i * m + a]! - floor[i]!) * cell;
    if (have <= EPSILON) continue;
    const take = Math.min(have, left);
    // Each spoke gives in proportion to what it holds, so a leaning heap
    // drains from where its sand is.
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const own = (height[k]! - floor[i]!) * cell;
      height[k] = height[k]! - (take * own) / have / cell;
    }
    left -= take;
  }
  return amount - left;
}

/** The slope the heap holds now: its angle of repose, flattened by however
 *  shaken it is. */
export function holds(bulb: Bulb): number {
  return bulb.slope * (1 - GIVE_SLOPE * Math.min(1, Math.max(0, bulb.give)));
}

/** Move sand between two cells so that the drop between them, read against
 *  gravity, is no steeper than `max` over their distance — never more than
 *  the higher has, never more than the lower has room for. */
function slide(
  bulb: Bulb,
  p: number,
  q: number,
  ip: number,
  iq: number,
  dist: number,
  max: number,
): number {
  const { area, floor, ceiling, height, lean, m } = bulb;
  const diff = height[p]! + lean[p]! - (height[q]! + lean[q]!);
  const limit = max * dist;
  let from: number;
  let to: number;
  let ifrom: number;
  let ito: number;
  let over: number;
  if (diff > limit) {
    from = p;
    to = q;
    ifrom = ip;
    ito = iq;
    over = diff - limit;
  } else if (-diff > limit) {
    from = q;
    to = p;
    ifrom = iq;
    ito = ip;
    over = -diff - limit;
  } else {
    return 0;
  }
  const af = area[ifrom]! / m;
  const at = area[ito]! / m;
  // The volume that brings the difference back to the slope, given that a
  // cell's height moves by volume over area on both sides.
  let dv = over / (1 / af + 1 / at);
  dv = Math.min(dv, (height[from]! - floor[ifrom]!) * af);
  dv = Math.min(dv, (ceiling[ito]! - height[to]!) * at);
  if (dv <= EPSILON) return 0;
  height[from] = height[from]! - dv / af;
  height[to] = height[to]! + dv / at;
  return dv;
}

/**
 * The apex — the innermost ring — levelled against the lean, keeping its
 * sand: the level is the one at which the spokes, each held between the
 * floor and the ceiling, hold what they held (a steep lean presses some
 * against one or the other, so it is found rather than averaged). Returns
 * how much sand moved.
 */
export function levelApex(bulb: Bulb): number {
  const { m, height, lean } = bulb;
  const lo = bulb.floor[0]!;
  const hi = bulb.ceiling[0]!;
  let held = 0;
  let low = Infinity;
  let high = -Infinity;
  for (let a = 0; a < m; a++) {
    held += height[a]!;
    low = Math.min(low, lo + lean[a]!);
    high = Math.max(high, hi + lean[a]!);
  }
  const at = (level: number) => {
    let v = 0;
    for (let a = 0; a < m; a++) {
      v += Math.max(lo, Math.min(level - lean[a]!, hi));
    }
    return v;
  };
  for (let k = 0; k < 48; k++) {
    const mid = (low + high) / 2;
    if (at(mid) < held) low = mid;
    else high = mid;
  }
  const level = (low + high) / 2;
  let moved = 0;
  for (let a = 0; a < m; a++) {
    const h = Math.max(lo, Math.min(level - lean[a]!, hi));
    moved += Math.abs(h - height[a]!);
    height[a] = h;
  }
  return moved * (bulb.area[0]! / m);
}

/**
 * One pass of the angle of repose over the surface: between every two
 * neighbouring cells — ring against ring along each spoke, and spoke
 * against spoke round each ring — if the surface drops more steeply than
 * the sand holds, enough slides down the slope to bring it back to that
 * angle. Read against gravity's lean, so a tilted glass settles to a
 * surface that leans with it. Returns how much sand moved.
 */
export function relax(bulb: Bulb, sweeps = 1, slope?: number): number {
  let moved = 0;
  const { n, m, centre } = bulb;
  const max = slope ?? holds(bulb);
  const dr = centre[0]! * 2;
  for (let s = 0; s < sweeps; s++) {
    // Alternate the direction, so a long slope settles from both ends
    // rather than marching one way.
    const forward = s % 2 === 0;
    for (let k = 0; k < n - 1; k++) {
      const i = forward ? k : n - 2 - k;
      for (let a = 0; a < m; a++) {
        moved += slide(bulb, i * m + a, (i + 1) * m + a, i, i + 1, dr, max);
      }
    }
    for (let i = 1; i < n; i++) {
      const arc = (2 * Math.PI * centre[i]!) / m;
      for (let k = 0; k < m; k++) {
        const a = forward ? k : m - 1 - k;
        const b = (a + 1) % m;
        moved += slide(bulb, i * m + a, i * m + b, i, i, arc, max);
      }
    }
    // The innermost ring is the apex, and one cell in all but name: its
    // spokes are levelled against the lean rather than slid round, which
    // keeps the apex from chattering between its radial and its angular
    // neighbours.
    moved += levelApex(bulb);
  }
  return moved;
}

/** Below this much movement in a pair of sweeps the heap counts as still. */
const STILL = 1e-12;

/** Relax until nothing moves any more (or the sweeps run out). */
export function settle(bulb: Bulb, maxSweeps = 3000): void {
  for (let s = 0; s < maxSweeps; s += 2) {
    if (relax(bulb, 2) < STILL) return;
  }
}

/** A repeatable number in 0..1 for a seed. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A shake: grains thrown from cell to neighbouring cell, uphill as readily
 * as down, by `strength` (0..1) of the sand's own height, in a pattern
 * drawn from `seed` so a frame's throw is not the last frame's. What it
 * throws, `relax` brings down again — which is the churn of a shaken glass.
 * Returns how much sand moved.
 */
export function jolt(bulb: Bulb, strength: number, seed: number): number {
  if (strength <= 0) return 0;
  const { n, m, area, floor, ceiling, height, centre } = bulb;
  const dr = centre[0]! * 2;
  let moved = 0;
  const throws = Math.ceil(strength * n * m * 0.15);
  for (let k = 0; k < throws; k++) {
    const i = Math.floor(hash(seed * 3.1 + k * 7.7) * n);
    const a = Math.floor(hash(seed * 5.3 + k * 2.9) * m);
    const p = i * m + a;
    const cell = area[i]! / m;
    const have = (height[p]! - floor[i]!) * cell;
    if (have <= EPSILON) continue;
    // A neighbour: out, in, or round, as the hash falls.
    const which = hash(seed * 1.7 + k * 4.3);
    let iq = i;
    let aq = a;
    if (which < 0.3) iq = Math.min(n - 1, i + 1);
    else if (which < 0.6) iq = Math.max(0, i - 1);
    else if (which < 0.8) aq = (a + 1) % m;
    else aq = (a + m - 1) % m;
    if (iq === i && aq === a) continue;
    const q = iq * m + aq;
    const cq = area[iq]! / m;
    let dv = Math.min(have, strength * dr * 0.12 * cell * hash(seed + k * 9.9));
    dv = Math.min(dv, (ceiling[iq]! - height[q]!) * cq);
    if (dv <= EPSILON) continue;
    height[p] = height[p]! - dv / cell;
    height[q] = height[q]! + dv / cq;
    moved += dv;
  }
  return moved;
}

/**
 * The heap as a level fill: a flat surface — level against gravity, so
 * leaning with the tilt in the bulb's frame — holding `amount`, found by
 * bisection on the level. What sand looks like right after the glass has
 * been turned and the whole heap has dropped onto the other end.
 */
export function levelFill(bulb: Bulb, amount: number): void {
  clear(bulb);
  const { n, m, area, floor, ceiling, lean } = bulb;
  const held = (level: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const cell = area[i]! / m;
      for (let a = 0; a < m; a++) {
        const top = Math.min(level - lean[i * m + a]!, ceiling[i]!);
        if (top > floor[i]!) v += cell * (top - floor[i]!);
      }
    }
    return v;
  };
  let lo = -1;
  let hi = 0;
  for (let i = 0; i < n; i++) hi = Math.max(hi, ceiling[i]!);
  for (let k = 0; k < n * m; k++) {
    lo = Math.min(lo, -Math.abs(lean[k]!) - 1);
    hi = Math.max(hi, hi + Math.abs(lean[k]!));
  }
  if (amount >= held(hi)) {
    for (let i = 0; i < n; i++)
      bulb.height.fill(ceiling[i]!, i * m, (i + 1) * m);
    return;
  }
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if (held(mid) < amount) lo = mid;
    else hi = mid;
  }
  const level = (lo + hi) / 2;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      bulb.height[k] = Math.max(
        floor[i]!,
        Math.min(level - lean[k]!, ceiling[i]!),
      );
    }
  }
}

/** The heap as a cone: `amount` poured in where the stream lands and left
 *  to settle, which is what the bottom bulb holds after the stream has
 *  been running. */
export function pileFill(
  bulb: Bulb,
  amount: number,
  steps = 40,
  x = 0,
  z = 0,
): void {
  clear(bulb);
  for (let k = 0; k < steps; k++) {
    pour(bulb, amount / steps, x, z);
    relax(bulb, 8);
  }
  settle(bulb);
}

/** The heap as a funnel: a level fill of `full` drained down to `amount`
 *  through the hole, a little at a time, which is what the top bulb holds
 *  part way through a run. */
export function funnelFill(
  bulb: Bulb,
  full: number,
  amount: number,
  steps = 60,
): void {
  levelFill(bulb, full);
  const out = Math.max(0, full - amount);
  for (let k = 0; k < steps; k++) {
    drain(bulb, out / steps);
    relax(bulb, 8);
  }
  settle(bulb);
}
