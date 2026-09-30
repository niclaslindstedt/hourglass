// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  AIR_CAP,
  capacity,
  cellAt,
  clear,
  holds,
  leanTo,
  pour,
  relax,
  spokeAngle,
  type Bulb,
} from "./sand.ts";

// The sand in motion: what a heap does between two frames, as physics
// rather than as a rule that snaps it to shape.
//
// Sand is two things at once, and the model keeps both (the two-layer
// split of the "shallow sand" height-field models, after Savage and
// Hutter's depth-averaged avalanche equations):
//
//   THE DENSE LAYER is the heap (`sand.ts`'s cells), and on it a thin
//   flowing layer with momentum. Every edge between two cells carries a
//   speed. Gravity along the surface drives it and Coulomb friction holds
//   it back, with the two friction angles real sand has: an avalanche
//   starts only where the slope passes the STATIC angle (the angle of
//   repose plus about two and a half degrees, as measured on dune slip
//   faces), and once moving it runs until the slope is down to the
//   DYNAMIC one — so a heap fed from above grows past its angle, lets go
//   in a slump, and stops a little flatter, the way the cone under an
//   hourglass's stream does. A slope a flow is running down takes time to
//   come down: the sand has to speed up, and it is only as fast as a
//   layer a few millimetres thick can carry.
//
//   THE DILUTE LAYER is the grains in the air (`Bulb.air`): thrown up by
//   a shake, or falling from one end of the bulb to the other when the
//   glass is turned over. Each is ballistic under the gravity the glass
//   feels — the Earth's, less the glass's own acceleration, so a phone
//   jerked down faster than a fall lifts the heap off its floor — bounces
//   off the glass with a little of its speed (and a hit for the phone to
//   buzz with, `buzzFor`), and joins the heap again where it lands.
//
// Every grain is volume: sand thrown up is taken off its cell and put
// back where it lands, so the sand is conserved through all of it to the
// last ring. The clock is not in here: how much has run through is
// `timer.ts`'s, drained and poured by the loop. What happens here is only
// where the sand that is in each bulb lies.
//
// Pure and clock-free: `dt` is a parameter, and what looks like chance is
// a hash of a seed.

/** How tall the glass is in the world, for gravity's strength in the
 *  model's unit — the whole hourglass's height. A desk hourglass is about
 *  a hand and a half. */
export const GLASS_METRES = 0.22;

/** One g, in heights a second squared. */
export const G = 9.81 / GLASS_METRES;

/** How deep the flowing layer is: about fifteen grains — a few
 *  millimetres on a desk glass. */
const LAYER = 0.018;

/** How much steeper sand stands before it lets go than it stops at: the
 *  static angle over the dynamic, in radians. */
export const STATIC_EXTRA = (2.5 * Math.PI) / 180;

/** The fastest the flowing layer moves, heights a second. */
const VMAX = 2.5;

/** The longest step the flow and the grains are integrated over; a longer
 *  frame is cut into steps this long. */
const SUBSTEP = 1 / 240;

/** A frame longer than this is not integrated past it: the loop settles a
 *  heap after a long sleep instead. */
const LONGEST = 1 / 15;

/** How much of its speed into the glass a grain keeps when it hits it, and
 *  how much of its speed along it. */
const RESTITUTION = 0.3;
const WALL_SLIP = 0.8;

/** How much of a hit on the heap (rather than the glass) is felt. */
const SOFT = 0.25;

/** How deep a layer of sand one g of pull away from the floor throws up. */
const LIFT = 0.02;

/** The steepest lean gravity is read at, as a tangent: seventy degrees.
 *  Past it the heap would stand against a wall, which the heights cannot
 *  say. */
const MAX_LEAN = Math.tan((70 * Math.PI) / 180);

const EPS = 1e-13;

/** A repeatable number in 0..1 for a seed. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The gravity the bulb feels, in g, in its own frame: across (`gx`),
 * along the heights (`gy`, negative towards the resting end) and across
 * (`gz`). The Earth's pull less the glass's own acceleration, so it need
 * be neither one g nor pointing at the floor. The heap reads its lean off
 * it (capped where the heap would stand against the wall); when it pulls
 * away from the floor the heap is thrown up on the next step.
 */
export function setGravity(
  bulb: Bulb,
  gx: number,
  gy: number,
  gz: number,
): void {
  bulb.g = [gx, gy, gz];
  const along = Math.max(0.2, -gy);
  let tx = gx / along;
  let tz = gz / along;
  const t = Math.hypot(tx, tz);
  if (t > MAX_LEAN) {
    tx *= MAX_LEAN / t;
    tz *= MAX_LEAN / t;
  }
  if (
    Math.abs(tx - bulb.tilt[0]) > 1e-3 ||
    Math.abs(tz - bulb.tilt[1]) > 1e-3
  ) {
    leanTo(bulb, tx, tz);
  }
}

/** The friction coefficients the heap flows by now: the dynamic one (its
 *  angle of repose, flattened by a shake) and the static one over it. */
export function frictionOf(bulb: Bulb): { still: number; moving: number } {
  const moving = holds(bulb);
  return {
    moving,
    still: Math.tan(Math.atan(moving) + STATIC_EXTRA),
  };
}

/** One edge of the flowing layer over `dt`: the speed from gravity along
 *  the slope and friction against it, then the sand it carries. Returns
 *  the volume moved. */
function edge(
  b: Bulb,
  vel: Float64Array,
  e: number,
  p: number,
  q: number,
  ip: number,
  iq: number,
  dist: number,
  face: number,
  dt: number,
  gt: number,
  still: number,
  moving: number,
): number {
  const { height: h, lean, floor, ceiling, area, m } = b;
  const diff = h[p]! + lean[p]! - (h[q]! + lean[q]!);
  const s = diff / dist;
  const u = vel[e]!;
  // Static: friction holds any slope up to the static angle.
  if (u === 0 && Math.abs(s) <= still) return 0;
  const cos = 1 / Math.sqrt(1 + s * s);
  const sin = s * cos;
  const dir = u !== 0 ? Math.sign(u) : Math.sign(s);
  let un = u + gt * (sin - dir * moving * cos) * dt;
  // Friction brings a flow to rest; it never turns it round.
  if (Math.sign(un) !== dir) {
    vel[e] = 0;
    return 0;
  }
  if (un > VMAX) un = VMAX;
  else if (un < -VMAX) un = -VMAX;
  const forward = un > 0;
  const from = forward ? p : q;
  const to = forward ? q : p;
  const ifrom = forward ? ip : iq;
  const ito = forward ? iq : ip;
  const depth = h[from]! - floor[ifrom]!;
  if (depth <= EPS) {
    vel[e] = 0;
    return 0;
  }
  const af = area[ifrom]! / m;
  const at = area[ito]! / m;
  let dv = Math.abs(un) * Math.min(depth, LAYER) * face * dt;
  // Downhill a flow stops where the slope has come down to the dynamic
  // angle: never past it, which is what keeps a heap from sloshing into a
  // hollow.
  const drop = forward ? diff : -diff;
  if (drop > 0) {
    const over = drop - moving * dist;
    if (over <= 0) {
      vel[e] = 0;
      return 0;
    }
    const most = over / (1 / af + 1 / at);
    if (dv >= most) {
      dv = most;
      un = 0;
    }
  }
  dv = Math.min(dv, depth * af * 0.5, (ceiling[ito]! - h[to]!) * at);
  vel[e] = un;
  if (dv <= EPS) return 0;
  h[from] = h[from]! - dv / af;
  h[to] = h[to]! + dv / at;
  return dv;
}

/**
 * The flowing layer over `dt`: every edge along each spoke and round each
 * ring, then the apex — the innermost ring, one cell in all but name —
 * levelled against the lean. Returns how much sand moved.
 */
export function flow(bulb: Bulb, dt: number): number {
  const { n, m, centre, vr, va, g } = bulb;
  // No weight on the floor, no friction and no flow: a heap in free fall
  // or thrown up is the grains' business.
  if (g[1] > -0.05) return 0;
  const gt = Math.hypot(g[0], g[1], g[2]) * G;
  const { still, moving } = frictionOf(bulb);
  const dr = centre[0]! * 2;
  let moved = 0;
  for (let i = 0; i < n - 1; i++) {
    const face = (2 * Math.PI * (i + 1) * dr) / m;
    for (let a = 0; a < m; a++) {
      const p = i * m + a;
      moved += edge(
        bulb,
        vr,
        p,
        p,
        p + m,
        i,
        i + 1,
        dr,
        face,
        dt,
        gt,
        still,
        moving,
      );
    }
  }
  for (let i = 1; i < n; i++) {
    const arc = (2 * Math.PI * centre[i]!) / m;
    for (let a = 0; a < m; a++) {
      const p = i * m + a;
      const q = i * m + ((a + 1) % m);
      moved += edge(bulb, va, p, p, q, i, i, arc, dr, dt, gt, still, moving);
    }
  }
  let level = 0;
  for (let a = 0; a < m; a++) level += bulb.height[a]! + bulb.lean[a]!;
  level /= m;
  for (let a = 0; a < m; a++) {
    bulb.height[a] = Math.max(
      bulb.floor[0]!,
      Math.min(level - bulb.lean[a]!, bulb.ceiling[0]!),
    );
  }
  return moved;
}

/** Whether the flowing layer is moving anywhere. */
export function flowing(bulb: Bulb): boolean {
  const { vr, va } = bulb;
  for (let k = 0; k < vr.length; k++) {
    if (vr[k] !== 0 || va[k] !== 0) return true;
  }
  return false;
}

/** The glass's radius at a height from the resting end. */
export function wallAt(bulb: Bulb, y: number): number {
  const s = bulb.shape;
  const c = Math.min(s.height, Math.max(0, y));
  return s.radiusAt(bulb.rest === "waist" ? c : s.height - c);
}

/** Put a grain in the air; false when the air is full (the caller puts
 *  its sand back on the heap). */
export function launch(
  bulb: Bulb,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  vol: number,
): boolean {
  const air = bulb.air;
  if (air.count >= AIR_CAP) return false;
  const k = air.count++;
  air.x[k] = x;
  air.y[k] = y;
  air.z[k] = z;
  air.vx[k] = vx;
  air.vy[k] = vy;
  air.vz[k] = vz;
  air.vol[k] = vol;
  return true;
}

/** How much sand is in the air. */
export function airborne(bulb: Bulb): number {
  let v = 0;
  for (let k = 0; k < bulb.air.count; k++) v += bulb.air.vol[k]!;
  return v;
}

/** Take grain `k` out of the air (the last one takes its place). */
function drop(bulb: Bulb, k: number): void {
  const air = bulb.air;
  const last = --air.count;
  if (k === last) return;
  air.x[k] = air.x[last]!;
  air.y[k] = air.y[last]!;
  air.z[k] = air.z[last]!;
  air.vx[k] = air.vx[last]!;
  air.vy[k] = air.vy[last]!;
  air.vz[k] = air.vz[last]!;
  air.vol[k] = air.vol[last]!;
}

/**
 * The grains in the air over `dt`: gravity, the glass, and the heap. A
 * grain that reaches the glass bounces off it — the wall's own slope
 * decides which way — and one that reaches the heap's surface is part of
 * the heap again. Every hit is counted into `bulb.hits`.
 */
export function fly(bulb: Bulb, dt: number): void {
  const air = bulb.air;
  const { m, height, shape } = bulb;
  const [gx, gy, gz] = bulb.g;
  const ax = gx * G;
  const ay = gy * G;
  const az = gz * G;
  const H = shape.height;
  const cap = capacity(bulb);
  const drag = 1 - 0.4 * dt;
  let k = 0;
  while (k < air.count) {
    let vx = (air.vx[k]! + ax * dt) * drag;
    let vy = (air.vy[k]! + ay * dt) * drag;
    let vz = (air.vz[k]! + az * dt) * drag;
    let x = air.x[k]! + vx * dt;
    let y = air.y[k]! + vy * dt;
    let z = air.z[k]! + vz * dt;
    const vol = air.vol[k]!;
    // The far end of the bulb.
    if (y > H) {
      y = H;
      if (vy > 0) {
        bulb.hits += (vol * vy * vy) / cap;
        vy = -vy * RESTITUTION;
      }
    }
    // The wall: the surface r = R(y), whose outward normal leans with its
    // slope along the height.
    const R = wallAt(bulb, y) * 0.97;
    const r = Math.hypot(x, z);
    if (r > R && r > 1e-9) {
      const e = 1e-3;
      const slope = (wallAt(bulb, y + e) - wallAt(bulb, y - e)) / (2 * e);
      const ux = x / r;
      const uz = z / r;
      const kn = 1 / Math.sqrt(1 + slope * slope);
      const nx = ux * kn;
      const ny = -slope * kn;
      const nz = uz * kn;
      const vn = vx * nx + vy * ny + vz * nz;
      if (vn > 0) {
        bulb.hits += (vol * vn * vn) / cap;
        const tx = vx - vn * nx;
        const ty = vy - vn * ny;
        const tz = vz - vn * nz;
        vx = tx * WALL_SLIP - vn * RESTITUTION * nx;
        vy = ty * WALL_SLIP - vn * RESTITUTION * ny;
        vz = tz * WALL_SLIP - vn * RESTITUTION * nz;
      }
      x = ux * R;
      z = uz * R;
    }
    // The heap, or the end it rests against.
    const [i, a] = cellAt(bulb, x, z);
    if (vy <= 0 && (y <= height[i * m + a]! || y <= 0)) {
      bulb.hits += (SOFT * vol * (vx * vx + vy * vy + vz * vz)) / cap;
      pour(bulb, vol, x, z);
      drop(bulb, k);
      continue;
    }
    air.x[k] = x;
    air.y[k] = y;
    air.z[k] = z;
    air.vx[k] = vx;
    air.vy[k] = vy;
    air.vz[k] = vz;
    k++;
  }
}

/**
 * A pull away from the floor — the glass jerked towards its resting end
 * faster than it would fall — throws the top of the heap into the air:
 * a layer as deep as the pull is strong, from every cell with sand, each
 * with a little sideways scatter drawn from `seed`. Once per stroke.
 */
export function toss(bulb: Bulb, seed: number): number {
  const pull = bulb.g[1];
  if (pull < 0) {
    if (pull < -0.2) bulb.thrown = false;
    return 0;
  }
  if (bulb.thrown || pull < 0.1) return 0;
  bulb.thrown = true;
  const { n, m, area, floor, height, centre } = bulb;
  let thrown = 0;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS) continue;
      const dv = Math.min(depth, LIFT * Math.min(pull, 3)) * cell;
      const t = spokeAngle(bulb, a);
      const r = centre[i]!;
      const s = seed * 7.1 + k * 1.3;
      const spread = 0.35 * Math.min(pull, 2);
      if (
        !launch(
          bulb,
          r * Math.cos(t),
          height[k]!,
          r * Math.sin(t),
          (hash(s) - 0.5) * spread,
          hash(s + 2.2) * spread * 0.5,
          (hash(s + 4.4) - 0.5) * spread,
          dv,
        )
      ) {
        return thrown;
      }
      height[k] = height[k]! - dv / cell;
      thrown += dv;
    }
  }
  return thrown;
}

/**
 * Turn the glass over: the heap in each bulb lets go of the end it rested
 * against and falls to the other, which is where the other bulb's role
 * now rests. `a` and `b` swap their sand — `a`'s falls into `b`'s frame
 * and `b`'s into `a`'s — as grains, two a cell, so the heap drops as a
 * body and lands in a scatter the flow then brings to its angle.
 *
 * `mirror` is for a glass turned in the picture — half a turn about the
 * axis into the screen, so what was on the right is on the left. A glass
 * turned with the phone is the same glass in the same place on the screen,
 * only upside down, and nothing crosses over.
 */
export function turnOver(a: Bulb, b: Bulb, mirror = true): void {
  const fromA = grainsOf(a);
  const fromB = grainsOf(b);
  clear(a);
  clear(b);
  place(b, fromA, mirror);
  place(a, fromB, mirror);
}

type Grain = [number, number, number, number, number, number, number];

/** The sand of a bulb as grains in its own frame: the heap, two a cell, and
 *  whatever is already in the air. */
function grainsOf(bulb: Bulb): Grain[] {
  const out: Grain[] = [];
  const { n, m, area, floor, height, centre, air } = bulb;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS) continue;
      const t = spokeAngle(bulb, a);
      const x = centre[i]! * Math.cos(t);
      const z = centre[i]! * Math.sin(t);
      out.push([x, floor[i]! + depth * 0.75, z, 0, 0, 0, (depth * cell) / 2]);
      out.push([x, floor[i]! + depth * 0.25, z, 0, 0, 0, (depth * cell) / 2]);
    }
  }
  for (let k = 0; k < air.count; k++) {
    out.push([
      air.x[k]!,
      air.y[k]!,
      air.z[k]!,
      air.vx[k]!,
      air.vy[k]!,
      air.vz[k]!,
      air.vol[k]!,
    ]);
  }
  return out;
}

/** Grains from the other end of the glass into this bulb's frame: the
 *  heights read from the other end, and — turned in the picture — right
 *  and left swapped. */
function place(bulb: Bulb, grains: Grain[], mirror: boolean): void {
  const H = bulb.shape.height;
  const k = mirror ? -1 : 1;
  for (const [x, y, z, vx, vy, vz, vol] of grains) {
    const X = k * x;
    const Y = H - y;
    if (!launch(bulb, X, Y, z, k * vx, -vy, vz, vol)) pour(bulb, vol, X, z);
  }
}

/**
 * The sand over one frame of `dt` seconds: thrown up if the glass pulls
 * away from it, the flowing layer and the grains in the air stepped
 * together, and a last sweep that lets go of any cliff far past the
 * static angle — a heap the loop has just built or dropped, which a flow
 * a few millimetres deep would take seconds to bring down. `seed` draws a
 * shake's scatter.
 */
export function step(bulb: Bulb, dt: number, seed: number): void {
  const span = Math.min(LONGEST, Math.max(0, dt));
  const steps = Math.max(1, Math.ceil(span / SUBSTEP));
  const h = span / steps;
  for (let s = 0; s < steps; s++) {
    toss(bulb, seed + s * 0.37);
    flow(bulb, h);
    fly(bulb, h);
  }
  const { still } = frictionOf(bulb);
  relax(bulb, 1, still * 1.35);
}

/** Whether anything in the bulb is still moving: a flow, or a grain in the
 *  air. */
export function moving(bulb: Bulb): boolean {
  return bulb.air.count > 0 || flowing(bulb);
}

/** How hard a hit is felt, as the length of a buzz in milliseconds, from
 *  the hits a frame counted (`Bulb.hits`, summed over both bulbs): nothing
 *  under a few stray grains, a tick for a shake's handful, a thud for a
 *  whole heap landing. */
export function buzzFor(hits: number): number {
  const FLOOR = 0.01;
  if (hits < FLOOR) return 0;
  return Math.round(Math.min(40, 8 + 5 * Math.log2(hits / FLOOR)));
}
