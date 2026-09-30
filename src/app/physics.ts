// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  AIR_CAP,
  capacity,
  cellAt,
  clear,
  holds,
  leanTo,
  levelApex,
  pour,
  relax,
  spokeAngle,
  type Bulb,
  type Spin,
} from "./sand.ts";

// The sand in motion: what a heap does between two frames, as physics
// rather than as a rule that snaps it to shape.
//
// Sand is two things at once, and the model keeps both (the two-layer
// split of the "shallow sand" height-field models, after Savage and
// Hutter's depth-averaged avalanche equations):
//
//   THE DENSE LAYER is the heap (`sand.ts`'s cells), and on it a thin
//   flowing layer with momentum: every edge between two cells carries a
//   speed, driven by gravity along the slope and held back by the basal
//   friction of Pouliquen and Forterre's empirical law for dense granular
//   flows ("Friction law for dense granular flows", J. Fluid Mech. 2002),
//   measured on real layers: a static layer starts to move only past its
//   START angle and a moving one stops only below its STOP angle, about a
//   degree apart; a thin layer stands steeper than a thick one (both
//   angles rise as the depth falls towards a few grains); and a moving
//   layer's friction rises with its Froude number, u/√(gh), which is what
//   gives a flow a speed it settles at rather than one it gains without
//   end. So a heap fed from above grows past its angle, lets go in a slump,
//   and stops a little flatter — the cone under an hourglass's stream.
//
//   THE DILUTE LAYER is the grains in the air (`Bulb.air`): thrown up by
//   a shake, or falling from one end of the bulb to the other when the
//   glass is turned over. Each is ballistic under the gravity the glass
//   feels — the Earth's, less the glass's own acceleration, so a phone
//   jerked down faster than a fall lifts the heap off its floor — bounces
//   off the glass with a little of its speed (and a hit for the phone to
//   buzz with, `buzzFor`), and joins the heap again where it lands.
//
// A glass spun about its own axis by a finger spins its sand only as far
// as friction drags it round (`whirl`), and spinning sand is pushed out
// from the axis, ω²r: a level surface becomes a bowl (`Bulb.bowl`, read
// into the lean), so a fast spin piles the heap up the wall and the flow
// brings it back down when the spin dies. Nothing in a spin about the
// axis pushes the sand to one side.
//
// A glass turned over by a tap is a turning frame (`setSpin`): while it
// turns, the sand in it feels gravity swinging round the glass and the
// pulls of the turn itself — outward from the waist it turns about, as
// ω²r, so sand at the far end of a bulb is pressed out harder than sand by
// the hole; sideways as the turn quickens and slows, α×r, so the sand lags
// the start of the turn and runs on at its end; and across its own path,
// 2ω×v, once it moves. The heap feels them at its middle: its surface
// slides as soon as the pull leans past the sand's angle (the turn is too
// quick for the flowing layer alone, so the heap is held to that angle
// every step). Each cell of it feels them where it is, and lets go of its
// end the moment the pull there turns away from that end (`letGo`) — the
// sand far from the waist first — and each grain then flies under the
// pull where it is, hits the glass, slides and lands.
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

const DEG = Math.PI / 180;

/** Pouliquen and Forterre's fit for glass beads: δ1, the stop angle of a
 *  thick layer; δ2, the stop angle of a vanishingly thin one; δ3, the
 *  start angle of a thick one; L, the depth over which a thin layer's
 *  extra steepness fades (0.65 mm, as a share of the glass's height); β,
 *  the flow rule's constant; γ, the power the friction is carried down to
 *  standstill by. Each sand's own angle of repose stands for δ1 (`look.ts`
 *  measures it on a heap, a thick layer), and δ2 and δ3 keep the paper's
 *  distances from it. */
const DELTA2_OVER = (30.7 - 21) * DEG;
const DELTA3_OVER = (22.2 - 21) * DEG;
const DEPTH_L = 0.65e-3 / GLASS_METRES;
export const BETA = 0.136;
const GAMMA = 1e-3;

/** The fastest the flowing layer moves, heights a second. */
const VMAX = 2.5;

/** The longest step the flow and the grains are integrated over; a longer
 *  frame is cut into steps this long. */
const SUBSTEP = 1 / 240;

/** A frame longer than this is not integrated past it: the loop settles a
 *  heap after a long sleep instead. */
const LONGEST = 1 / 15;

/** How much of its speed into the glass a grain keeps when it hits it
 *  (what it loses along it is `WALL_FRICTION`'s). */
const RESTITUTION = 0.3;

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
 *
 * In a turning glass (`setSpin`, set first) the turn's own pull at the
 * heap's middle is added.
 */
export function setGravity(
  bulb: Bulb,
  gx: number,
  gy: number,
  gz: number,
): void {
  const spin = bulb.spin;
  if (spin) {
    // The turn's pull at the heap's middle, which the heap as a whole
    // leans and flows by.
    const [cx, cy, cz] = heapCentre(bulb);
    turnPull(bulb, spin, cx, cy, cz, 0, 0, 0);
    spin.base = [PULL[0]! / G, PULL[1]! / G, PULL[2]! / G];
    gx += spin.base[0];
    gy += spin.base[1];
    gz += spin.base[2];
  }
  bulb.g = [gx, gy, gz];
  const along = Math.max(0.2, -gy);
  let tx = gx / along;
  let tz = gz / along;
  const t = Math.hypot(tx, tz);
  if (t > MAX_LEAN) {
    tx *= MAX_LEAN / t;
    tz *= MAX_LEAN / t;
  }
  // The sand's own spin makes a bowl of a level surface: the pull out from
  // the axis over gravity along it.
  const bowl = (bulb.whirl * bulb.whirl) / (along * G);
  if (
    Math.abs(tx - bulb.tilt[0]) > 1e-3 ||
    Math.abs(tz - bulb.tilt[1]) > 1e-3 ||
    Math.abs(bowl - bulb.bowl) > 1e-3 * (1 + bulb.bowl)
  ) {
    leanTo(bulb, tx, tz, bowl, MAX_LEAN);
  }
}

/** How hard the glass grips the sand it turns, as a coefficient of
 *  friction: sand on glass. */
const SPIN_GRIP = 0.4;

/**
 * The glass spinning about its own axis at `rate` rad/s, over `dt`: the
 * sand is not fixed to the glass, and turns with it only as friction
 * drags it round — the floor's grip on a heap pressed to it, which spins
 * up a disc of sand at most (4/3)·μ·g/R — so it takes up a fast spin over
 * a moment, and runs on a moment when the glass stops. Its spin is what
 * pushes it out from the axis (`setGravity`, `Bulb.bowl`): a slow turn
 * leaves the heap as it lies, a fast one piles it up the wall. Call
 * before `setGravity`.
 */
export function whirl(bulb: Bulb, rate: number, dt: number): void {
  const along = Math.max(0, -bulb.g[1]);
  const most = ((4 / 3) * SPIN_GRIP * along * G * dt) / bulb.shape.radius;
  const d = rate - bulb.whirl;
  bulb.whirl = Math.abs(d) <= most ? rate : bulb.whirl + Math.sign(d) * most;
}

/**
 * The glass turning about its waist, in the bulb's frame: `w` its angular
 * speed, rad/s, and `alpha` its angular acceleration, rad/s² — or null
 * when it is not turning. Set before `setGravity`, which adds the turn's
 * pull at the heap to the gravity the heap feels.
 */
export function setSpin(
  bulb: Bulb,
  w: [number, number, number] | null,
  alpha: [number, number, number] = [0, 0, 0],
): void {
  bulb.spin = w ? { w, alpha, base: [0, 0, 0] } : null;
}

/** Where the turn's pull is written, heights a second squared. */
const PULL = new Float64Array(3);

/**
 * What a turning glass adds to the pull on a grain at (x, y, z) moving at
 * (vx, vy, vz) in the bulb's frame, into `PULL`: the centrifugal pull out
 * from the waist, −ω×(ω×r), the Euler pull of the turn quickening or
 * slowing, −α×r, and the Coriolis pull across the grain's path, −2ω×v.
 * `r` is measured from the waist, the point the glass turns about.
 */
function turnPull(
  bulb: Bulb,
  spin: Spin,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
): void {
  const [wx, wy, wz] = spin.w;
  const [ax, ay, az] = spin.alpha;
  const rx = x;
  const ry = bulb.rest === "waist" ? y : y - bulb.shape.height;
  const rz = z;
  // ω×r, then −ω×(ω×r).
  const cx = wy * rz - wz * ry;
  const cy = wz * rx - wx * rz;
  const cz = wx * ry - wy * rx;
  PULL[0] =
    -(wy * cz - wz * cy) - (ay * rz - az * ry) - 2 * (wy * vz - wz * vy);
  PULL[1] =
    -(wz * cx - wx * cz) - (az * rx - ax * rz) - 2 * (wz * vx - wx * vz);
  PULL[2] =
    -(wx * cy - wy * cx) - (ax * ry - ay * rx) - 2 * (wx * vy - wy * vx);
}

/** The middle of the heap's sand, in the bulb's frame; the middle of the
 *  bulb when there is none. */
export function heapCentre(bulb: Bulb): [number, number, number] {
  const { n, m, area, floor, height, centre } = bulb;
  let v = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS) continue;
      const dv = depth * cell;
      const t = spokeAngle(bulb, a);
      v += dv;
      x += dv * centre[i]! * Math.cos(t);
      y += dv * (floor[i]! + depth / 2);
      z += dv * centre[i]! * Math.sin(t);
    }
  }
  if (v <= EPS) return [0, bulb.shape.height / 2, 0];
  return [x / v, y / v, z / v];
}

/** The friction the heap flows by now, as the law's three tangents: the
 *  stop angle of a thick layer (the sand's angle of repose, flattened by a
 *  shake), of a thin one, and the start angle of a thick one. `still` and
 *  `moving` are the start and stop friction of a layer as deep as the
 *  flowing layer. */
export type Friction = {
  t1: number;
  t2: number;
  t3: number;
  still: number;
  moving: number;
};

export function frictionOf(bulb: Bulb): Friction {
  const t1 = holds(bulb);
  const a1 = Math.atan(t1);
  const f = {
    t1,
    t2: Math.tan(a1 + DELTA2_OVER),
    t3: Math.tan(a1 + DELTA3_OVER),
    still: 0,
    moving: 0,
  };
  f.still = muStart(f, LAYER);
  f.moving = muStop(f, LAYER);
  return f;
}

/** The friction a layer `h` deep comes to rest at (Pouliquen and Forterre,
 *  eq. 3.8). */
export function muStop(f: Friction, h: number): number {
  return f.t1 + (f.t2 - f.t1) / (h / DEPTH_L + 1);
}

/** The friction a layer `h` deep must be pushed past to start (eq. 3.9). */
export function muStart(f: Friction, h: number): number {
  return f.t3 + (f.t2 - f.t1) / (h / DEPTH_L + 1);
}

/** The friction of a layer `h` deep moving at Froude number `fr`
 *  (eqs. 3.5, 3.6): past β, the stop friction of the depth the flow rule
 *  says a steady flow at this speed would have; under it, carried down to
 *  the start friction at standstill. */
export function muFlow(f: Friction, h: number, fr: number): number {
  if (fr > BETA) return muStop(f, (h * BETA) / fr);
  return (fr / BETA) ** GAMMA * (muStop(f, h) - muStart(f, h)) + muStart(f, h);
}

/** One edge of the flowing layer over `dt`: the speed from gravity along
 *  the slope and the law's friction against it, then the sand it carries.
 *  Returns the volume moved. */
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
  f: Friction,
): number {
  const { height: h, lean, floor, ceiling, area, m } = b;
  const diff = h[p]! + lean[p]! - (h[q]! + lean[q]!);
  const s = diff / dist;
  const u = vel[e]!;
  const dir = u !== 0 ? Math.sign(u) : Math.sign(s);
  if (dir === 0) return 0;
  const forward = dir > 0;
  const from = forward ? p : q;
  const ifrom = forward ? ip : iq;
  const depth = h[from]! - floor[ifrom]!;
  if (depth <= EPS) {
    vel[e] = 0;
    return 0;
  }
  // The flowing layer: the top of the heap, as deep as the sand is, up to
  // the layer's own depth.
  const hf = Math.max(1e-6, Math.min(depth, LAYER));
  const cos = 1 / Math.sqrt(1 + s * s);
  const sin = s * cos;
  // Static: friction holds any slope up to the start angle of a layer this
  // deep.
  if (u === 0 && Math.abs(s) <= muStart(f, hf)) return 0;
  const fr = Math.abs(u) / Math.sqrt(gt * hf * cos);
  const mu = muFlow(f, hf, fr);
  let un = u + gt * (sin - dir * mu * cos) * dt;
  // Friction brings a flow to rest; it never turns it round.
  if (Math.sign(un) !== dir) {
    vel[e] = 0;
    return 0;
  }
  if (un > VMAX) un = VMAX;
  else if (un < -VMAX) un = -VMAX;
  const to = forward ? q : p;
  const ito = forward ? iq : ip;
  const af = area[ifrom]! / m;
  const at = area[ito]! / m;
  let dv = Math.abs(un) * hf * face * dt;
  // Downhill a flow stops where the slope has come down to the stop angle
  // of the layer: never past it, which is what keeps a heap from sloshing
  // into a hollow.
  const drop = forward ? diff : -diff;
  if (drop > 0) {
    const over = drop - muStop(f, hf) * dist;
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
  const f = frictionOf(bulb);
  const dr = centre[0]! * 2;
  let moved = 0;
  for (let i = 0; i < n - 1; i++) {
    const face = (2 * Math.PI * (i + 1) * dr) / m;
    for (let a = 0; a < m; a++) {
      const p = i * m + a;
      moved += edge(bulb, vr, p, p, p + m, i, i + 1, dr, face, dt, gt, f);
    }
  }
  for (let i = 1; i < n; i++) {
    const arc = (2 * Math.PI * centre[i]!) / m;
    for (let a = 0; a < m; a++) {
      const p = i * m + a;
      const q = i * m + ((a + 1) % m);
      moved += edge(bulb, va, p, p, q, i, i, arc, dr, dt, gt, f);
    }
  }
  levelApex(bulb);
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

/** Whether the hole is fed: gravity toward the end the bulb rests on,
 *  leaning off its axis by no more than `maxLean` (a tangent — the lean
 *  that halts a run held on its side), and sand on the cells at the bore.
 *  A turning glass's upper heap starts to run when this first holds. */
export function feedsHole(bulb: Bulb, maxLean: number): boolean {
  const [gx, gy, gz] = bulb.g;
  if (gy >= 0 || Math.hypot(gx, gz) > -gy * maxLean) return false;
  const { m, height, floor } = bulb;
  for (let a = 0; a < m; a++) if (height[a]! - floor[0]! > EPS) return true;
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
  const spin = bulb.spin;
  let k = 0;
  while (k < air.count) {
    let px = ax;
    let py = ay;
    let pz = az;
    if (spin) {
      // The turn's pull where this grain is, in place of the heap's.
      turnPull(
        bulb,
        spin,
        air.x[k]!,
        air.y[k]!,
        air.z[k]!,
        air.vx[k]!,
        air.vy[k]!,
        air.vz[k]!,
      );
      px += PULL[0]! - spin.base[0] * G;
      py += PULL[1]! - spin.base[1] * G;
      pz += PULL[2]! - spin.base[2] * G;
    }
    let vx = (air.vx[k]! + px * dt) * drag;
    let vy = (air.vy[k]! + py * dt) * drag;
    let vz = (air.vz[k]! + pz * dt) * drag;
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
        // Coulomb's friction: the blow into the glass takes at most μ of
        // itself off the speed along it — so a grain pressed to the glass
        // slides down it as a grain on glass does, and one that strikes
        // it hard is caught.
        const along = Math.hypot(tx, ty, tz);
        const slip =
          along > 1e-12
            ? Math.max(0, along - WALL_FRICTION * (1 + RESTITUTION) * vn) /
              along
            : 0;
        vx = tx * slip - vn * RESTITUTION * nx;
        vy = ty * slip - vn * RESTITUTION * ny;
        vz = tz * slip - vn * RESTITUTION * nz;
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

/** How many grains a cell of the heap lets go as: enough that a falling
 *  heap reads as sand rather than as pebbles, few enough to fly them all. */
const PER_CELL = 4;

/** A point in cell (`i`, `a`), somewhere across it rather than at its
 *  centre — drawn from `seed` — so a heap that lets go falls as a scatter
 *  and not as the grid it was kept in. */
function inCell(
  bulb: Bulb,
  i: number,
  a: number,
  seed: number,
): [number, number] {
  const dr = bulb.centre[0]! * 2;
  const r = Math.max(0, bulb.centre[i]! + (hash(seed * 1.7) - 0.5) * dr);
  const t =
    spokeAngle(bulb, a) + ((hash(seed * 3.1 + 5) - 0.5) * 2 * Math.PI) / bulb.m;
  return [r * Math.cos(t), r * Math.sin(t)];
}

/**
 * The cells of a heap in a turning glass that are pulled off the end they
 * rest on: nothing holds sand to a floor it is pulled away from, so each
 * such cell lets go at once, as grains — `PER_CELL` a cell, where they
 * lay, moving with the glass — which then fly under the pull where each
 * one is. The pull is read at each cell, not at the heap's middle: the
 * turn pulls hardest far from the waist, and sideways by how far off the
 * axis a cell is, so a heap comes away unevenly, its far side first. Only
 * while the glass turns (`setSpin`); a shake throws a layer instead
 * (`toss`). Returns how much sand let go.
 */
export function letGo(bulb: Bulb): number {
  const spin = bulb.spin;
  if (!spin) return 0;
  const { n, m, area, floor, height, centre } = bulb;
  // Gravity alone, without the turn's pull at the heap's middle.
  const gy = bulb.g[1] - spin.base[1];
  let gone = 0;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS) continue;
      const t = spokeAngle(bulb, a);
      const r = centre[i]!;
      const mid = floor[i]! + depth / 2;
      turnPull(bulb, spin, r * Math.cos(t), mid, r * Math.sin(t), 0, 0, 0);
      if (gy + PULL[1]! / G <= 0) continue;
      const part = (depth * cell) / PER_CELL;
      // From the top of the cell down, so a full air leaves the bottom of
      // the heap where it was.
      for (let j = PER_CELL - 1; j >= 0; j--) {
        const [x, z] = inCell(bulb, i, a, k + j / PER_CELL);
        const y = floor[i]! + (depth * (j + 0.5)) / PER_CELL;
        if (!launch(bulb, x, y, z, 0, 0, 0, part)) return gone;
        height[k] = height[k]! - depth / PER_CELL;
        gone += part;
      }
      height[k] = floor[i]!;
      bulb.vr[k] = 0;
      bulb.va[k] = 0;
    }
  }
  return gone;
}

/**
 * Turn the glass over: the heap in each bulb lets go of the end it rested
 * against and falls to the other, which is where the other bulb's role
 * now rests. `a` and `b` swap their sand — `a`'s falls into `b`'s frame
 * and `b`'s into `a`'s — as grains, `PER_CELL` a cell, so the heap drops as a
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

/** The sand of a bulb as grains in its own frame: the heap, `PER_CELL` a
 *  cell, and whatever is already in the air. */
function grainsOf(bulb: Bulb): Grain[] {
  const out: Grain[] = [];
  const { n, m, area, floor, height, air } = bulb;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS) continue;
      const part = (depth * cell) / PER_CELL;
      for (let j = 0; j < PER_CELL; j++) {
        const [x, z] = inCell(bulb, i, a, k + j / PER_CELL);
        const y = floor[i]! + (depth * (j + 0.5)) / PER_CELL;
        out.push([x, y, z, 0, 0, 0, part]);
      }
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
 * The sand over one frame of `dt` seconds: let go where a turning glass
 * pulls it off its floor, thrown up if a shaken one does, the flowing layer and the grains in the air stepped
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
    if (bulb.spin) letGo(bulb);
    else toss(bulb, seed + s * 0.37);
    flow(bulb, h);
    fly(bulb, h);
  }
  const { still } = frictionOf(bulb);
  // A turn swings gravity round the heap faster than a flow a few
  // millimetres deep can follow: the surface is held to the angle it
  // starts to slide at, so it slides as the glass turns.
  if (bulb.spin) relax(bulb, 2, still);
  else relax(bulb, 1, still * 1.35);
}

/** Whether anything in the bulb is still moving: a flow, a grain in the
 *  air, or the sand still turning. */
export function moving(bulb: Bulb): boolean {
  return bulb.air.count > 0 || flowing(bulb) || bulb.whirl !== 0;
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

/** The stream from the bore to the heap: the points it passes through in
 *  the sink's frame and the moment a grain reaches each (seconds after it
 *  left the bore), where it lands, and the first point that is on the glass
 *  rather than in the air (`count` when it never reaches it). */
export type StreamPath = {
  /** x, y, z a point, `count` of them. */
  points: number[];
  times: number[];
  count: number;
  landX: number;
  landZ: number;
  wall: number;
};

/** Dry sand on glass: the friction a grain sliding on the glass meets, as
 *  a coefficient. Measured for glass beads on dry clear glass, about 0.16
 *  ("Experimental determinations of contact friction for spherical glass
 *  particles", Powder Technology 2021); a little higher for sand's angular
 *  grains. On a smooth wall a constant (Coulomb) friction describes a thin
 *  granular flow well (Pouliquen and Forterre 2002). */
export const WALL_FRICTION = 0.2;

/** The step the stream is traced by, seconds. */
const STREAM_DT = 1 / 1500;

/**
 * Where the stream goes, traced as the grains move:
 *
 * - OUT OF THE BORE: grains fall freely from the "free-fall arch" that
 *   stands about a hole's width over the orifice, so they leave it at
 *   about √(g·D), down the glass's axis, the way the bore points.
 * - THROUGH THE AIR: a projectile under the gravity the glass feels, which
 *   bends the stream from the axis toward the way gravity pulls when the
 *   glass leans.
 * - ONTO THE GLASS: a dense granular jet that meets a surface turns along
 *   it, its speed into the surface spent (granular-jet impact experiments
 *   and Johnson and Gray's jets on an incline, J. Fluid Mech. 2011), and
 *   runs on down the inside of the wall as a rivulet: gravity along the
 *   wall drives it and Coulomb friction (`WALL_FRICTION`) against the push
 *   into the wall holds it back — so it slides, speeding up, where the
 *   wall is steep, and stops where the wall is flatter than the friction
 *   angle, piling there.
 * - ONTO THE HEAP, where it lands and `pour` puts the sand.
 *
 * `wallFriction` is for the tests.
 */
export function streamPath(
  bulb: Bulb,
  wallFriction = WALL_FRICTION,
): StreamPath {
  const H = bulb.shape.height;
  const { m, height } = bulb;
  let [gx, gy, gz] = bulb.g;
  // The stream only ever falls: with no pull toward the plate it is the
  // grains' business, and it is traced as barely falling.
  if (gy > -0.05) gy = -0.05;
  const gAll = Math.hypot(gx, gy, gz) * G;
  const gl = Math.hypot(gx, gy, gz);
  const ax0 = (gx / gl) * gAll;
  const ay0 = (gy / gl) * gAll;
  const az0 = (gz / gl) * gAll;
  // Out of the bore at the free-fall arch's speed, down the axis.
  let vx = 0;
  let vy = -Math.sqrt(gAll * 2 * bulb.shape.bore);
  let vz = 0;
  let x = 0;
  let y = H;
  let z = 0;
  let t = 0;
  const points = [x, y, z];
  const times = [0];
  let wall = -1;
  let onWall = false;
  const normal = (px: number, py: number, pz: number): number[] => {
    const r = Math.hypot(px, pz) || 1e-9;
    const e = 1e-3;
    const slope = (wallAt(bulb, py + e) - wallAt(bulb, py - e)) / (2 * e);
    const kn = 1 / Math.sqrt(1 + slope * slope);
    return [(px / r) * kn, -slope * kn, (pz / r) * kn];
  };
  for (let k = 0; k < 6000; k++) {
    let ax = ax0;
    let ay = ay0;
    let az = az0;
    if (onWall) {
      const [nx, ny, nz] = normal(x, y, z);
      // The push into the glass is what friction is made of; with none,
      // the wall overhangs and the stream leaves it.
      const push = ax * nx! + ay * ny! + az * nz!;
      if (push <= 0) {
        onWall = false;
      } else {
        // Along the wall: gravity less its push, and the speed kept to the
        // wall's surface.
        ax -= push * nx!;
        ay -= push * ny!;
        az -= push * nz!;
        const vn = vx * nx! + vy * ny! + vz * nz!;
        vx -= vn * nx!;
        vy -= vn * ny!;
        vz -= vn * nz!;
        const speed = Math.hypot(vx, vy, vz);
        const drive = Math.hypot(ax, ay, az);
        const hold = wallFriction * push;
        if (speed < 1e-4) {
          // At rest on the glass: it stays unless gravity along the wall
          // beats the friction — the sand piles where the wall is flat.
          if (drive <= hold) break;
          ax -= (hold * ax) / drive;
          ay -= (hold * ay) / drive;
          az -= (hold * az) / drive;
        } else {
          ax -= (hold * vx) / speed;
          ay -= (hold * vy) / speed;
          az -= (hold * vz) / speed;
          // Friction stops a slide; it never turns it round.
          const nvx = vx + ax * STREAM_DT;
          const nvy = vy + ay * STREAM_DT;
          const nvz = vz + az * STREAM_DT;
          if (nvx * vx + nvy * vy + nvz * vz < 0) {
            vx = 0;
            vy = 0;
            vz = 0;
            continue;
          }
        }
      }
    }
    vx += ax * STREAM_DT;
    vy += ay * STREAM_DT;
    vz += az * STREAM_DT;
    let nx = x + vx * STREAM_DT;
    let ny = y + vy * STREAM_DT;
    let nz = z + vz * STREAM_DT;
    t += STREAM_DT;
    // The glass: the jet meets it and turns along it.
    const R = wallAt(bulb, ny) * 0.97;
    const r = Math.hypot(nx, nz);
    if (r > R && r > 1e-9) {
      nx *= R / r;
      nz *= R / r;
      const [ux, uy, uz] = normal(nx, ny, nz);
      const vn = vx * ux! + vy * uy! + vz * uz!;
      if (vn > 0) {
        vx -= vn * ux!;
        vy -= vn * uy!;
        vz -= vn * uz!;
      }
      if (!onWall && wall < 0) wall = points.length / 3;
      onWall = true;
    }
    // The heap, or the plate under it.
    const [i, a] = cellAt(bulb, nx, nz);
    const surface = height[i * m + a]!;
    const landed = ny <= surface || ny <= 0;
    if (landed) ny = Math.max(surface, 0);
    x = nx;
    y = ny;
    z = nz;
    // A point every few steps is plenty to draw the stream by.
    if (landed || k % 6 === 5) {
      points.push(x, y, z);
      times.push(t);
    }
    if (landed) break;
  }
  if (times[times.length - 1] !== t) {
    points.push(x, y, z);
    times.push(t);
  }
  const count = points.length / 3;
  return {
    points,
    times,
    count,
    landX: x,
    landZ: z,
    wall: wall < 0 ? count : wall,
  };
}
